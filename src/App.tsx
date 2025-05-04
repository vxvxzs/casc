import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import './App.css';
import Modal from './components/modal';
import TrackMap from './components/TrackMap';

// Typy
type User = {
  id: string;
  email: string;
  name: string;
  password?: string; // backend nie powinien tego zwracać, ale mock może mieć
  avatar: string;
  createdAt: string;
  stats?: {
    sessions: number;
    tracks: number;
    cars: number;
    totalTime: string;
    improvement: string;
  };
  history: any[];
};

type GameData = {
  [key: string]: {
    tracks: string[];
    carClasses: string[];
  };
};

const gameData: GameData = {
  "Le Mans Ultimate": {
    tracks: ["Bahrain", "Circuit de la Sarthe", "COTA", "Fuji", "Imola", "Interlagos", "Monza", "Portimao", "Sebring", "Spa"],
    carClasses: ["Hypercar", "LMPGT3", "LMP2", "GTE"]
  },
  "iRacing": {
    tracks: [
      "Spa-Francorchamps", "Daytona Road Course", "Watkins Glen", "Monza", "Sebring",
      "Barcelona-Catalunya", "Le Mans", "Suzuka", "Red Bull Ring", "Silverstone",
      "Mount Panorama", "Laguna Seca", "Road America", "Nürburgring GP + Nordschleife",
      "Hockenheimring", "Brands Hatch", "Donington Park", "Imola", "Zandvoort",
      "Montreal (Gilles Villeneuve)", "Virginia International Raceway", "Road Atlanta",
      "Oulton Park", "Phillip Island", "Fuji Speedway", "Interlagos",
      "COTA (Circuit of the Americas)", "Long Beach", "Mid-Ohio", "Sonoma",
      "Snetterton", "Jerez", "Magny-Cours", "MotorLand Aragón", "Oran Park"
    ],
    carClasses: [
      "GT3", "GT4", "GTE", "LMP2", "LMP3", "GTP", "TCR", "Formula 4",
      "Formula 3", "Formula 2", "Formula 1", "IndyCar"
    ]
  },
  "Assetto Corsa Competizione": {
    tracks: [
      "Spa-Francorchamps", "Monza", "Imola", "Silverstone", "Nürburgring GP",
      "Brands Hatch", "Red Bull Ring", "Barcelona-Catalunya", "Zandvoort",
      "Laguna Seca", "Suzuka", "Bathurst (Mount Panorama)", "Watkins Glen",
      "Indianapolis", "COTA", "Kyalami", "Paul Ricard", "Donington Park",
      "Snetterton", "Oulton Park", "Valencia", "Misano", "Hungaroring"
    ],
    carClasses: [
      "GT3", "GT4", "Cup (Porsche 911 GT3 Cup)",
      "Super Trofeo (Lamborghini Huracán ST)",
      "Challenger (Ferrari 488 Challenge Evo)"
    ]
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [showModal, setShowModal] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setAnalysisHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch('http://localhost:5050/profile', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : Promise.reject()),
      fetch('http://localhost:5050/history', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => res.ok ? res.json() : Promise.reject())
    ])
      .then(([userObj, historyArr]) => {
        setUser(userObj);
        setAnalysisHistory(historyArr);
      })
      .catch(() => {
        setUser(null);
        setAnalysisHistory([]);
        localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  // REJESTRACJA
  const register = async (userData: { name: string; email: string; password: string; avatar: string }) => {
    setAuthError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5050/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Registration failed');
      const { user, token } = await response.json();
      setUser(user);
      localStorage.setItem('token', token);
      setAnalysisHistory([]);
      return true;
    } catch {
      setAuthError('Registration failed. Email may already be in use.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // LOGOWANIE
  const login = async (email: string, password: string) => {
    setAuthError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5050/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setAuthError('Invalid email or password');
        return;
      }
      const { user, token } = await response.json();
      setUser(user);
      localStorage.setItem('token', token);
      // po logowaniu pobierz historię
      const historyRes = await fetch('http://localhost:5050/history', { headers: { Authorization: `Bearer ${token}` } });
      setAnalysisHistory(historyRes.ok ? await historyRes.json() : []);
    } catch {
      setAuthError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  // WYLOGOWANIE
  const logout = () => {
    setUser(null);
    setAnalysisHistory([]);
    localStorage.removeItem('token');
  };

  // ANALIZA – po udanej analizie pobierz świeżą historię!
  const addAnalysis = async (data: any) => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    setLoading(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('telemetry', data.telemetryFile);
      formDataObj.append('track', data.track);
      formDataObj.append('carClass', data.carClass);
      formDataObj.append('game', data.game);
      formDataObj.append('notes', data.notes || '');
      const response = await fetch('http://localhost:5050/analyze', {
        method: 'POST',
        body: formDataObj,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Analysis failed');
      // pobierz świeżą historię
      const historyRes = await fetch('http://localhost:5050/history', { headers: { Authorization: `Bearer ${token}` } });
      setAnalysisHistory(historyRes.ok ? await historyRes.json() : []);
      return true;
    } catch {
      alert('Analysis failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} />
      <div className="app-container">
        <header className="header">
          <Link to="/" className="logo-link">
            <motion.h1
              className="logo"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="logo-icon">🏎️</span>
              RaceSpace
            </motion.h1>
          </Link>
          <nav className="main-nav">
            <ul className="nav-list">
              <li className="nav-item">
                <Link to="/" className="nav-link">Home</Link>
              </li>
              {user && analysisHistory.length > 0 && (
                <li className="nav-item">
                  <Link to="/history" className="nav-link">History</Link>
                </li>
              )}
              {user ? (
                <>
                  <li className="nav-item">
                    <Link to="/profile" className="nav-link">Profile</Link>
                  </li>
                  <li className="nav-item">
                    <button onClick={logout} className="nav-button">
                      Logout
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li className="nav-item">
                    <Link to="/login" className="nav-link">Login</Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/register" className="nav-link">Register</Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </header>

        <main className="main-content">
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '60px' }}>Loading...</div>
          ) : (
            <Routes>
              <Route path="/" element={<HomePage user={user} addAnalysis={addAnalysis} gameData={gameData} />} />
              <Route path="/login" element={<LoginPage login={login} loading={loading} error={authError} />} />
              <Route path="/register" element={<RegisterPage register={register} loading={loading} error={authError} />} />
              <Route path="/profile" element={<ProfilePage user={user} loading={loading} />} />
              <Route path="/history" element={<HistoryPage history={analysisHistory} user={user} loading={loading} />} />
              <Route path="/results/:id" element={<ResultsPage history={analysisHistory} />} />
            </Routes>
          )}
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} RaceSpace | AI-Powered Telemetry Analysis</p>
        </footer>
      </div>
    </Router>
  );
}

// --- Pozostałe komponenty ---

function HomePage({ user, addAnalysis, gameData }: { user: User | null, addAnalysis: (data: any) => Promise<boolean>, gameData: GameData }) {
  const [formData, setFormData] = useState({
    game: '',
    track: '',
    carClass: '',
    notes: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [telemetryFile, setTelemetryFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telemetryFile) return;

    setIsAnalyzing(true);

    const analysisSuccess = await addAnalysis({
      ...formData,
      telemetryFile,
      date: new Date().toISOString().split('T')[0],
      status: 'completed'
    });

    setIsAnalyzing(false);

    if (analysisSuccess) {
      navigate('/history');
    } else {
      alert('Analysis failed. Please try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setTelemetryFile(e.target.files[0]);
    }
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <h2>Improve Your Lap Times with AI Analysis</h2>
        <p>Upload your telemetry data and get detailed insights about your racing performance</p>
      </section>

      <div className="analysis-form-container">
        <motion.div
          className="form-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3>New Analysis</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="telemetryFile">Telemetry File</label>
                <input
                  type="file"
                  id="telemetryFile"
                  name="telemetryFile"
                  onChange={handleFileChange}
                  accept=".csv,.json,.motec,.rdp"
                />
                <small>Supported formats: CSV, JSON, MoTeC, RDP</small>
              </div>

              <div className="form-group">
                <label htmlFor="game">Game</label>
                <select
                  id="game"
                  name="game"
                  value={formData.game}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select Game</option>
                  {Object.keys(gameData).map(game => (
                    <option key={game} value={game}>{game}</option>
                  ))}
                </select>
              </div>

              {formData.game && (
                <>
                  <div className="form-group">
                    <label htmlFor="track">Track</label>
                    <select
                      id="track"
                      name="track"
                      value={formData.track}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Track</option>
                      {gameData[formData.game].tracks.map(track => (
                        <option key={track} value={track}>{track}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="carClass">Car Class</label>
                    <select
                      id="carClass"
                      name="carClass"
                      value={formData.carClass}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Class</option>
                      {gameData[formData.game].carClasses.map(carClass => (
                        <option key={carClass} value={carClass}>{carClass}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group full-width">
                <label htmlFor="notes">Notes (Optional)</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Any additional information about this session..."
                ></textarea>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={isAnalyzing || !telemetryFile}
              >
                {isAnalyzing ? (
                  <>
                    <span className="loader"></span>
                    Analyzing...
                  </>
                ) : (
                  'Start Analysis'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function RegisterPage({ register, loading, error }: {
  register: (userData: any) => Promise<boolean>;
  loading: boolean;
  error: string;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!");
      return;
    }
    const success = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      avatar: `https://i.pravatar.cc/150?u=${formData.email}`
    });
    if (success) navigate('/profile');
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>Create Account</h2>
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nickname</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Password (min 6 characters)</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? <span className="loader"></span> : 'Register'}
          </button>
        </form>

        <p className="auth-note">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}

function LoginPage({ login, loading, error }: {
  login: (email: string, password: string) => void;
  loading: boolean;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password);
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2>Welcome Back</h2>
        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? <span className="loader"></span> : 'Login'}
          </button>
        </form>

        <p className="auth-note">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </motion.div>
    </div>
  );
}

function ProfilePage({ user, loading }: { user: User | null; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 60 }}>Loading profile...</div>;
  }
  if (!user) {
    return (
      <div className="not-logged-in">
        <h2>Please log in to view profile</h2>
        <Link to="/login" className="btn btn-primary">
          Go to Login
        </Link>
      </div>
    );
  }

  // Zabezpieczenie na brak stats w user
  const stats = user.stats ?? {
    sessions: 0,
    tracks: 0,
    cars: 0,
    totalTime: '0h 0m',
    improvement: '+0.0s'
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={user.avatar} alt="Profile" className="avatar" />
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <p>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <h3>Sessions</h3>
          <p>{stats.sessions}</p>
        </div>
        <div className="stat-card">
          <h3>Tracks</h3>
          <p>{stats.tracks}</p>
        </div>
        <div className="stat-card">
          <h3>Total Time</h3>
          <p>{stats.totalTime}</p>
        </div>
        <div className="stat-card">
          <h3>Improvement</h3>
          <p>{stats.improvement}</p>
        </div>
      </div>

      <div className="recent-sessions">
        <h3>Recent Sessions</h3>
        {user.history && user.history.length > 0 ? (
          user.history.slice(0, 5).map(session => (
            <div
              key={session.id}
              className="session-card"
              onClick={() => navigate(`/results/${session.id}`)}
            >
              <div className="session-info">
                <h4>{session.track || 'Unknown Track'}</h4>
                <p>{session.game} • {session.carClass} • {session.date}</p>
              </div>
              <div className="session-time">
                {session.stats?.lapTime || 'N/A'}
                <span className={session.improvement?.startsWith('+') ? 'regression' : 'improvement'}>
                  {session.improvement}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p>No sessions yet. Analyze your first telemetry file!</p>
        )}
      </div>
    </div>
  );
}

function HistoryPage({ history, user, loading }: { history: any[], user: User | null, loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 60 }}>Loading history...</div>;
  }
  if (!user) {
    return (
      <div className="not-logged-in">
        <h2>Please log in to view history</h2>
        <Link to="/login" className="btn btn-primary">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="history-page">
      <h2>Your Analysis History</h2>

      {history.length === 0 ? (
        <div className="no-history">
          <p>No analysis history yet</p>
          <Link to="/" className="btn btn-primary">
            Analyze First Session
          </Link>
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div
              key={item.id}
              className="history-item"
              onClick={() => navigate(`/results/${item.id}`)}
            >
              <div className="item-info">
                <h3>{item.track || 'Unknown Track'}</h3>
                <p>{item.game} • {item.carClass} • {item.date}</p>
              </div>
              <div className="item-status">
                {item.status === 'completed' ? (
                  <span className="completed">Completed</span>
                ) : (
                  <span className="pending">Pending</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsPage({ history }: { history: any[] }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const analysis = history.find(item => String(item.id) === String(id));

  if (!analysis) {
    return (
      <div className="not-found">
        <h2>Analysis not found</h2>
        <Link to="/" className="btn btn-primary">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="results-page">
      <div className="results-header">
        <h2>Analysis Results</h2>
        <p>{analysis.track || 'Unknown Track'} • {analysis.date}</p>
        {analysis.game && <p>Game: {analysis.game} • Class: {analysis.carClass}</p>}
      </div>

      {analysis.trackPoints && analysis.errors && (
        <TrackMap
          trackLine={analysis.trackPoints}
          errors={analysis.errors}
          onErrorSelect={(error: any) => {
            console.log('Selected error:', error);
          }}
        />
      )}

      <div className="analysis-stats">
        <div className="stat">
          <h3>Lap Time</h3>
          <p>{analysis.stats?.lapTime || 'N/A'}</p>
        </div>
        <div className="stat">
          <h3>Top Speed</h3>
          <p>{analysis.stats?.topSpeed || 'N/A'}</p>
        </div>
        <div className="stat">
          <h3>Throttle Usage</h3>
          <p>{analysis.stats?.throttleUsage || 'N/A'}</p>
        </div>
        <div className="stat">
          <h3>Braking Points</h3>
          <p>{analysis.stats?.brakingPoints || 'N/A'}</p>
        </div>
      </div>

      <div className="telemetry-section">
        <h3>Speed Analysis</h3>
        {analysis.telemetry?.speedAnalysis ? (
          <ul>
            {Object.entries(analysis.telemetry.speedAnalysis).map(([turn, data]: any, index) => (
              <li key={index}>
                <strong>{turn}:</strong> Entry {data.entry}, Exit {data.exit}
              </li>
            ))}
          </ul>
        ) : (
          <p>No speed data available</p>
        )}
      </div>

      <div className="telemetry-section">
        <h3>Braking Points</h3>
        {analysis.telemetry?.brakingPoints ? (
          <ul>
            {Object.entries(analysis.telemetry.brakingPoints).map(([turn, point]: any, index) => (
              <li key={index}>
                <strong>{turn}:</strong> {point}
              </li>
            ))}
          </ul>
        ) : (
          <p>No braking data available</p>
        )}
      </div>

      <div className="sectors-section">
        <h3>Sector Analysis</h3>
        {analysis.sectors?.length > 0 ? (
          <ul>
            {analysis.sectors.map((sector: any, index: number) => (
              <li key={index}>
                <strong>Sector {sector.number}:</strong> {sector.time}
                {sector.mistakes && sector.mistakes.length > 0 && (
                  <>
                    <br />
                    <span>Mistakes:</span>
                    <ul>
                      {sector.mistakes.map((mistake: any, idx: number) => (
                        <li key={idx}>
                          {mistake.description} — {mistake.solution} (Time lost: {mistake.timeLost})
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No sector data available</p>
        )}
      </div>

      <div className="recommendations-section">
        <h3>AI Recommendations</h3>
        {analysis.recommendations?.length > 0 ? (
          <ul>
            {analysis.recommendations.map((rec: string, index: number) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        ) : (
          <p>No recommendations available</p>
        )}
      </div>

      <button
        onClick={() => navigate('/')}
        className="btn btn-primary"
      >
        Analyze Another Session
      </button>
    </div>
  );
}

export default App;