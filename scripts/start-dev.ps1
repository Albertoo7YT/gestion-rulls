param(
  [switch]$NoDocker
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not $NoDocker -and (Test-Path "$repo\\docker-compose.yml")) {
  try {
    docker compose up -d | Out-Null
  } catch {
    try {
      docker-compose up -d | Out-Null
    } catch {
      Write-Host "No se pudo iniciar Docker Compose. Continua sin Docker." -ForegroundColor Yellow
    }
  }
}

npm run dev
