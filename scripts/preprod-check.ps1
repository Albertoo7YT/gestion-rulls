param(
  [string]$Token = "",
  [string]$ApiBase = "http://localhost:3001",
  [string]$WebBase = "http://localhost:3000",
  [int]$WaitSeconds = 20,
  [switch]$SkipStart,
  [switch]$SkipWeb,
  [switch]$KeepData
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
  throw "Necesitas pasar -Token con un JWT valido."
}

if (-not $SkipStart) {
  Write-Host "== Iniciando API y Web ==" -ForegroundColor Cyan
  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location -LiteralPath 'c:\Programa de gestion'; npm --workspace apps/api run start:dev"
  )
  if (-not $SkipWeb) {
    Start-Process powershell -ArgumentList @(
      "-NoExit",
      "-Command",
      "Set-Location -LiteralPath 'c:\Programa de gestion'; npm --workspace apps/web run dev"
    )
  }
  Write-Host "Esperando $WaitSeconds segundos..." -ForegroundColor Cyan
  Start-Sleep -Seconds $WaitSeconds
} else {
  Write-Host "== Saltando arranque (ya estan activos) ==" -ForegroundColor Cyan
}

Write-Host "== Verificacion ERP ==" -ForegroundColor Cyan
& "c:\Programa de gestion\scripts\full-verify.ps1" -ApiBase $ApiBase -Token $Token -KeepData:$KeepData

Write-Host "== Verificacion CRM ==" -ForegroundColor Cyan
& "c:\Programa de gestion\scripts\crm-verify.ps1" -ApiBase $ApiBase -Token $Token

Write-Host "== Fin verificacion pre-produccion ==" -ForegroundColor Cyan
