@echo off
REM Builds dist\PoisonScanner.exe  (needs Python 3.10+ from python.org with "tcl/tk" ticked)
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --noconfirm --onefile --windowed --name PoisonScanner ^
  --collect-all solders main.py
echo.
echo Done: dist\PoisonScanner.exe
pause
