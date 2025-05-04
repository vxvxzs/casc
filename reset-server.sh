#!/bin/bash
echo "=== FULL SERVER RESET ==="
PORT=5050

# Znajdź i zabij proces na porcie
PID=$(lsof -ti :$PORT)
if [ -n "$PID" ]; then
  echo "Killing process $PID..."
  kill -9 $PID
fi

# Wyczyść cache
rm -rf .cache/* .next/* node_modules/.cache

# Reinstalacja zależności
npm ci --force

# Uruchomienie
NODE_OPTIONS="--no-deprecation --no-warnings --no-experimental-fetch" \
  node server.mjs &
echo "Server should be running now!"