param(
  [string]$Token = "",
  [string]$ApiBase = "http://localhost:3001",
  [string]$WebBase = "http://localhost:3000",
  [int]$WaitSeconds = 15,
  [switch]$SkipStart,
  [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

if (-not $SkipStart) {
  Write-Host "== Iniciando API y Web ==" -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath 'c:\Programa de gestion'; npm --workspace apps/api run start:dev"
  )
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath 'c:\Programa de gestion'; npm --workspace apps/web run dev"
  )
  Write-Host "Esperando $WaitSeconds segundos..." -ForegroundColor Cyan
  Start-Sleep -Seconds $WaitSeconds
} else {
  Write-Host "== Saltando arranque (ya estan activos) ==" -ForegroundColor Cyan
}

Write-Host "== Ejecutando verificacion ==" -ForegroundColor Cyan
if ($Token) {
  & "c:\Programa de gestion\scripts\verify.ps1" -ApiBase $ApiBase -WebBase $WebBase -Token $Token -SkipWeb:$SkipWeb
} else {
  & "c:\Programa de gestion\scripts\verify.ps1" -ApiBase $ApiBase -WebBase $WebBase -SkipWeb:$SkipWeb
}
