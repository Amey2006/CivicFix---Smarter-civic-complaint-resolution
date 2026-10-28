# Starts the portable PostgreSQL and MongoDB installed in .dbtools (no Docker needed).
$root = $PSScriptRoot
& "$root\.dbtools\dl-pg\pgsql\bin\pg_ctl.exe" -D "$root\.dbtools\pgdata" -l "$root\.dbtools\pg.log" start
Start-Process -WindowStyle Minimized -FilePath "$root\.dbtools\dl-mongo\mongodb-win32-x86_64-windows-7.0.14\bin\mongod.exe" `
  -ArgumentList "--dbpath `"$root\.dbtools\mongodata`" --port 27017 --bind_ip 127.0.0.1"
Write-Host "PostgreSQL on :5432 and MongoDB on :27017 started."
