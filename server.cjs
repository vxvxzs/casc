require('regenerator-runtime/runtime');
const { parseIBT } = require('ibt-telemetry');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Papa = require('papaparse');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const crypto = require('crypto');

dotenv.config();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });


const app = express();
const port = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'supersekretnyklucz';

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowedTypes = ['.csv', '.json', '.ibt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// Prosta in-memory baza użytkowników
const users = new Map(); // id -> user

// JWT Auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak tokenu' });
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Nie znaleziono użytkownika' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

// Pomocnicza funkcja do liczenia analiz dziennych
function getToday() {
  return new Date().toISOString().slice(0, 10);
}
function canAnalyze(user) {
  if (user.isPremium) return true;
  const today = getToday();
  if (!user.analysisHistory) user.analysisHistory = {};
  if (!user.analysisHistory[today]) user.analysisHistory[today] = 0;
  return user.analysisHistory[today] < 2;
}
function registerAnalysis(user) {
  if (user.isPremium) return;
  const today = getToday();
  if (!user.analysisHistory) user.analysisHistory = {};
  if (!user.analysisHistory[today]) user.analysisHistory[today] = 0;
  user.analysisHistory[today]++;
}

// -- TELEMETRIA -- (jak poprzednio)
function sampleArray(arr, n) {
  if (!arr || arr.length === 0) return [];
  const step = Math.max(1, Math.floor(arr.length / n));
  return arr.filter((_, idx) => idx % step === 0);
}
async function parseIbtFile(filePath) {
  const ibtData = await parseIBT(filePath);
  const n = ibtData.data['CarIdxPosX'].length;
  const xArr = ibtData.data['CarIdxPosX'].map(row => row[0]);
  const yArr = ibtData.data['CarIdxPosY'].map(row => row[0]);
  const zArr = ibtData.data['CarIdxPosZ'].map(row => row[0]);
  const speedArr = ibtData.data['Speed'];
  const throttleArr = ibtData.data['Throttle'];
  const brakeArr = ibtData.data['Brake'];
  const gearArr = ibtData.data['CarIdxGear'].map(row => row[0]);
  const dataPoints = [];
  for (let i = 0; i < n; i++) {
    dataPoints.push({
      x: xArr[i],
      y: yArr[i],
      z: zArr[i],
      speed: speedArr[i],
      throttle: throttleArr[i],
      brake: brakeArr[i],
      gear: gearArr[i]
    });
  }
  const trackPoints = sampleArray(dataPoints, 200).map(pt => [pt.x, pt.y]);
  return { trackPoints, dataPoints };
}
function extractTrackPointsFromTelemetry(telemetryData, format) {
  let trackPoints = [], dataPoints = [];
  if (format === 'csv') {
    const parsedData = Papa.parse(telemetryData, { header: true, dynamicTyping: true, skipEmptyLines: true });
    if (parsedData.data && parsedData.data.length > 0) {
      const headers = Object.keys(parsedData.data[0]);
      const xPos = headers.find(h =>
        h.toLowerCase().includes('position_x') || h.toLowerCase().includes('x_pos') || h === 'x' || h.toLowerCase().includes('worldpositionx')
      );
      const yPos = headers.find(h =>
        h.toLowerCase().includes('position_z') || h.toLowerCase().includes('z_pos') || h === 'z' || h.toLowerCase().includes('worldpositionz')
      );
      if (xPos && yPos) {
        const sampleRate = Math.max(1, Math.floor(parsedData.data.length / 200));
        trackPoints = parsedData.data.filter((_, i) => i % sampleRate === 0).map(row => [row[xPos], row[yPos]]).filter(point => point[0] != null && point[1] != null);
        dataPoints = parsedData.data;
      }
    }
  } else if (format === 'json') {
    const data = JSON.parse(telemetryData);
    if (Array.isArray(data)) {
      trackPoints = data.filter(point => point.x != null && point.z != null).map(point => [point.x, point.z]);
      dataPoints = data;
    } else if (data.telemetry && Array.isArray(data.telemetry)) {
      trackPoints = data.telemetry.filter(point => point.position?.x != null && point.position?.z != null).map(point => [point.position.x, point.position.z]);
      dataPoints = data.telemetry;
    }
  }
  return { trackPoints, dataPoints };
}
function findProblemAreas(dataPoints) {
  const problems = [];
  const norm = arr => {
    const min = Math.min(...arr), max = Math.max(...arr);
    return arr.map(v => max > min ? ((v - min) / (max - min)) * 100 : 50);
  };
  const xs = dataPoints.map(p => p.x || 0);
  const ys = dataPoints.map(p => p.y || 0);
  const normX = norm(xs), normY = norm(ys);
  for (let i = 1; i < dataPoints.length - 1; i++) {
    const prev = dataPoints[i - 1], curr = dataPoints[i], next = dataPoints[i + 1];
    if (i % 10 !== 0) continue;
    const speedDrop = (prev.speed || 0) - (curr.speed || 0);
    if ((curr.brake ?? 0) > 0.8 && speedDrop > 20) {
      problems.push({ position: [normX[i], normY[i]], description: 'Mocne hamowanie', severity: 'high' });
    }
    if ((curr.brake ?? 0) > 0.2 && (curr.throttle ?? 0) > 0.5) {
      problems.push({ position: [normX[i], normY[i]], description: 'Nakładanie gazu i hamulca', severity: 'medium' });
    }
    if ((curr.gear ?? 0) < 3 && (curr.speed ?? 0) > 180) {
      problems.push({ position: [normX[i], normY[i]], description: 'Za późna zmiana biegu', severity: 'low' });
    }
  }
  return problems;
}
async function analyzeTelemetryWithAI(track, carClass, game, dataPoints, problems) {
  const aiPrompt = `Jestem kierowcą na torze ${track} (${game}, ${carClass}). Oto punkty telemetryczne i wykryte problemy:
${JSON.stringify(dataPoints.slice(0, 30))}... (łącznie ${dataPoints.length} punktów)
Wykryte błędy: ${JSON.stringify(problems)}

Podaj szczegółową analizę jazdy, wyciągnij wnioski, zaproponuj poprawki techniki oraz wygeneruj listę rekomendacji.`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEKAPI}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Jesteś profesjonalnym analitykiem motorsportu specjalizującym się w analizie telemetrii." },
        { role: "user", content: aiPrompt }
      ],
      temperature: 0.6
    })
  });
  if (!response.ok) throw new Error('AI analysis failed');
  const aiResponse = await response.json();
  return aiResponse.choices[0].message.content;
}

// --- AUTH ---

app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Brak wymaganych pól' });
    if ([...users.values()].some(u => u.email === email)) return res.status(400).json({ error: 'Email już zarejestrowany' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    const user = {
      id,
      email,
      name,
      password: hashedPassword,
      avatar: `https://avatars.dicebear.com/api/initials/${encodeURIComponent(name)}.svg`,
      createdAt: new Date().toISOString(),
      isPremium: false,
      analysisHistory: {} // { "2025-05-04": 2 }
    };
    users.set(id, user);
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ user: userWithoutPassword, token });
  } catch (e) {
    res.status(500).json({ error: 'Rejestracja nie powiodła się' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = [...users.values()].find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (e) {
    res.status(500).json({ error: 'Logowanie nie powiodło się' });
  }
});

app.post('/subscribe', auth, (req, res) => {
  // TO DO: tutaj podłącz płatności. Teraz tylko symulacja:
  req.user.isPremium = true;
  res.json({ success: true, isPremium: true });
});

// --- ANALYSIS ---

app.post('/analyze', auth, upload.single('telemetry'), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Brak autoryzacji' });
  if (!canAnalyze(req.user)) return res.status(402).json({ error: 'Limit darmowych analiz na dziś wyczerpany, wykup subskrypcję aby mieć nielimitowane analizy.' });
  if (!req.file) return res.status(400).json({ error: 'No telemetry file uploaded' });

  const { track, carClass, game } = req.body;
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let result;
    if (ext === '.ibt') {
      result = await parseIbtFile(filePath);
    } else if (ext === '.csv' || ext === '.json') {
      const telemetryData = fs.readFileSync(filePath, 'utf-8');
      result = extractTrackPointsFromTelemetry(telemetryData, ext.replace('.', ''));
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
    const problems = findProblemAreas(result.dataPoints);
    let analysisText = '';
    try {
      analysisText = await analyzeTelemetryWithAI(track, carClass, game, result.dataPoints, problems);
    } catch (err) {
      analysisText = 'AI analysis unavailable: ' + err.message;
    }
    // Zarejestruj analizę w historii
    registerAnalysis(req.user);

    res.json({
      track: track || null,
      carClass: carClass || null,
      game: game || null,
      status: 'completed',
      trackPoints: result.trackPoints,
      dataPoints: result.dataPoints,
      problemAreas: problems,
      analysis: analysisText,
      analysesToday: req.user.analysisHistory[getToday()] || 0,
      isPremium: req.user.isPremium
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze telemetry file: ' + err.message });
  } finally {
    fs.unlinkSync(filePath);
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'RaceSpace API is running',
    endpoints: {
      register: 'POST /register',
      login: 'POST /login',
      subscribe: 'POST /subscribe',
      analyze: 'POST /analyze (wymaga autoryzacji JWT)'
    },
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


app.get('/profile', auth, (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json(userWithoutPassword);
});

// GET /history
app.get('/history', auth, (req, res) => {
  res.json(req.user.history || []);
});