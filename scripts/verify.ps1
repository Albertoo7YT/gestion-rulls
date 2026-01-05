param(
  [string]$ApiBase = "http://localhost:3001",
  [string]$WebBase = "http://localhost:3000",
  [string]$Token = "",
  [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

function Write-Check {
  param([string]$Label, [bool]$Ok, [string]$Detail = "")
  if ($Ok) {
    Write-Host "[OK] $Label"
  } else {
    Write-Host "[FAIL] $Label $Detail"
  }
}

function Get-Headers {
  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }
  return $headers
}

Write-Host "== Verificacion ==" -ForegroundColor Cyan

# API health
try {
  $resp = Invoke-RestMethod -Uri "$ApiBase/health" -Method Get -TimeoutSec 10
  Write-Check "API /health" ($resp.ok -eq $true)
} catch {
  Write-Check "API /health" $false $_.Exception.Message
}

# Dashboard (requires auth)
try {
  $headers = Get-Headers
  if (-not $headers.Authorization) { throw "Falta token (-Token)" }
  $dash = Invoke-RestMethod -Uri "$ApiBase/dashboard" -Method Get -Headers $headers -TimeoutSec 10
  $ok = $null -ne $dash.kpis
  Write-Check "API /dashboard" $ok
} catch {
  Write-Check "API /dashboard" $false $_.Exception.Message
}

# Suggestions
try {
  $headers = Get-Headers
  if (-not $headers.Authorization) { throw "Falta token (-Token)" }
  $sug = Invoke-RestMethod -Uri "$ApiBase/suggestions/purchases?minStock=3&days=30&limit=5" -Method Get -Headers $headers -TimeoutSec 10
  $ok = $sug -is [System.Array]
  Write-Check "API /suggestions/purchases" $ok
} catch {
  Write-Check "API /suggestions/purchases" $false $_.Exception.Message
}

# Web (basic)
if ($SkipWeb) {
  Write-Check "WEB /" $true "omitido"
} else {
try {
  $resp = Invoke-WebRequest -Uri "$WebBase" -Method Get -TimeoutSec 10 -UseBasicParsing
    Write-Check "WEB /" ($resp.StatusCode -eq 200)
  } catch {
    Write-Check "WEB /" $false $_.Exception.Message
  }
}

Write-Host "== Fin ==" -ForegroundColor Cyan
