@echo off
"C:\Program Files\Git\cmd\git.exe" add package.json
"C:\Program Files\Git\cmd\git.exe" commit -m "Remover postinstall do prisma"
echo Atualizando o Github para consertar o Vercel...
start "" "C:\Program Files\Git\cmd\git.exe" push origin main
