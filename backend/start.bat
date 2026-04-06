@echo off
REM ═══════════════════════════════════════════════════════════
REM  US Training Backend — One-click startup
REM  Run this from the project root: .\backend\start.bat
REM ═══════════════════════════════════════════════════════════
echo.
echo  ╔════════════════════════════════════════╗
echo  ║  AI Ultrasound Training Backend        ║
echo  ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Check if venv exists
if not exist "venv\Scripts\activate.bat" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv. Make sure Python 3.10+ is installed.
        pause
        exit /b 1
    )
    echo [SETUP] Installing dependencies...
    call venv\Scripts\activate.bat
    pip install --upgrade pip --quiet
    pip install -r requirements.txt
    echo [SETUP] Dependencies installed.
) else (
    call venv\Scripts\activate.bat
)

echo [INFO]  Starting FastAPI server on http://localhost:8000
echo [INFO]  WebSocket at ws://localhost:8000/ws/{session_id}
echo [INFO]  Press CTRL+C to stop
echo.

python main.py
