$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

Write-Host "Starting API tunnel (port 3000)..."
Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:3000" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting Frontend tunnel (port 5173)..."
Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:5173" -WindowStyle Normal

Write-Host "Both tunnels started. Check the two new windows for URLs."
