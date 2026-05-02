#!/bin/bash
cd "$(dirname "$0")"

# Check if venv exists
if [ ! -f "venv/bin/activate" ]; then
    echo "[SETUP] Creating Python virtual environment..."
    /opt/homebrew/bin/python3.11 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create venv. Make sure Python 3.10+ is installed."
        exit 1
    fi
    echo "[SETUP] Installing dependencies..."
    source venv/bin/activate
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    echo "[SETUP] Dependencies installed."
else
    source venv/bin/activate
fi

echo "[INFO]  Starting FastAPI server on http://localhost:8000"
echo "[INFO]  WebSocket at ws://localhost:8000/ws/{session_id}"
echo "[INFO]  Press CTRL+C to stop"
echo

./venv/bin/python main.py
