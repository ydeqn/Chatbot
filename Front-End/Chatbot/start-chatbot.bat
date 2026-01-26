@echo off
echo Starting Career Guidance Chatbot...
echo.
echo Server will start on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
start http://localhost:8000/chat.html
python -m http.server 8000
