#!/bin/bash
# Double-click to view Portfolio V9: serves the website folder and opens
# the page. Close this Terminal window (or press Ctrl+C) to stop it.
cd "$(dirname "$0")/.." || exit 1
PORT=8793
if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 "Portfolio V9/tools/serve.py" $PORT >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  sleep 1
fi
open "http://localhost:$PORT/Portfolio%20V9/?hello"
echo "Portfolio V9 is at http://localhost:$PORT/Portfolio%20V9/"
echo "Leave this window open while you look at it. Press Ctrl+C to stop."
wait
