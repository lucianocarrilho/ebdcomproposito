@echo off
"C:\Program Files\Git\cmd\git.exe" init
"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/lucianocarrilho/ebdcomproposito.git
"C:\Program Files\Git\cmd\git.exe" config user.email "luciano@example.com"
"C:\Program Files\Git\cmd\git.exe" config user.name "Luciano"
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Initial commit by Antigravity"
echo Git commit ready! Now pushing to origin main...
start "" "C:\Program Files\Git\cmd\git.exe" push -u origin main
