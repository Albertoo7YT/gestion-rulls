param(
  [string]$ApiBase = "http://localhost:3001",
  [string]$Token = ""
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

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )
  $headers = Get-Headers
  if (-not $headers.Authorization) { throw "Falta token (-Token)" }
  $uri = "$ApiBase$Path"
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 15
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 15
}

Write-Host "== CRM verificacion ==" -ForegroundColor Cyan

$customer = $null
$statusId = $null
$taskId = $null
$segmentId = $null

try {
  $customer = Invoke-Api -Method Post -Path "/customers" -Body @{
    type = "b2c"
    name = "CRM Test " + (Get-Date -Format "yyyyMMddHHmmss")
  }
  Write-Check "Crear cliente" ($null -ne $customer.id)
} catch {
  Write-Check "Crear cliente" $false $_.Exception.Message
}

try {
  $board = Invoke-Api -Method Get -Path "/crm/board"
  $statusId = $board.statuses[0].id
  Write-Check "Listar board" ($null -ne $statusId)
} catch {
  Write-Check "Listar board" $false $_.Exception.Message
}

try {
  $moved = Invoke-Api -Method Post -Path "/crm/board/move" -Body @{
    customerId = $customer.id
    toStatusId = $statusId
    position = 1
  }
  Write-Check "Mover tarjeta" ($moved.statusId -eq $statusId)
} catch {
  Write-Check "Mover tarjeta" $false $_.Exception.Message
}

try {
  $summary = Invoke-Api -Method Get -Path "/crm/customers/$($customer.id)/summary"
  Write-Check "Resumen cliente" ($summary.customer.id -eq $customer.id)
} catch {
  Write-Check "Resumen cliente" $false $_.Exception.Message
}

try {
  $task = Invoke-Api -Method Post -Path "/crm/tasks" -Body @{
    type = "call"
    title = "Llamar cliente"
    relatedCustomerId = $customer.id
  }
  $taskId = $task.id
  Write-Check "Crear tarea" ($null -ne $taskId)
} catch {
  Write-Check "Crear tarea" $false $_.Exception.Message
}

try {
  $tasks = Invoke-Api -Method Get -Path "/crm/tasks?status=pending"
  Write-Check "Listar tareas" ($tasks.Count -ge 1)
} catch {
  Write-Check "Listar tareas" $false $_.Exception.Message
}

try {
  $updated = Invoke-Api -Method Patch -Path "/crm/tasks/$taskId" -Body @{
    completedAt = (Get-Date).ToString("o")
  }
  Write-Check "Completar tarea" ($null -ne $updated.completedAt)
} catch {
  Write-Check "Completar tarea" $false $_.Exception.Message
}

try {
  $event = Invoke-Api -Method Post -Path "/crm/calendar" -Body @{
    type = "meeting"
    title = "Demo CRM"
    startAt = (Get-Date).ToString("o")
    endAt = (Get-Date).AddHours(1).ToString("o")
    customerId = $customer.id
  }
  Write-Check "Crear evento" ($null -ne $event.id)
} catch {
  Write-Check "Crear evento" $false $_.Exception.Message
}

try {
  $from = (Get-Date).AddDays(-1).ToString("o")
  $to = (Get-Date).AddDays(2).ToString("o")
  $calendar = Invoke-Api -Method Get -Path "/crm/calendar?from=$from&to=$to"
  Write-Check "Listar calendario" ($calendar.Count -ge 1)
} catch {
  Write-Check "Listar calendario" $false $_.Exception.Message
}

try {
  $note = Invoke-Api -Method Post -Path "/crm/customers/$($customer.id)/notes" -Body @{
    content = "Nota de prueba CRM"
  }
  Write-Check "Crear nota" ($null -ne $note.id)
} catch {
  Write-Check "Crear nota" $false $_.Exception.Message
}

try {
  $timeline = Invoke-Api -Method Get -Path "/crm/customers/$($customer.id)/timeline"
  Write-Check "Timeline" ($timeline.Count -ge 1)
} catch {
  Write-Check "Timeline" $false $_.Exception.Message
}

try {
  $segment = Invoke-Api -Method Post -Path "/crm/segments" -Body @{
    name = "CRM Segment " + (Get-Date -Format "yyyyMMddHHmmss")
    filters = @{ active = $true }
    dynamic = $true
  }
  $segmentId = $segment.id
  Write-Check "Crear segmento" ($null -ne $segmentId)
} catch {
  Write-Check "Crear segmento" $false $_.Exception.Message
}

try {
  $segments = Invoke-Api -Method Get -Path "/crm/segments"
  Write-Check "Listar segmentos" ($segments.Count -ge 1)
} catch {
  Write-Check "Listar segmentos" $false $_.Exception.Message
}

try {
  $segCustomers = Invoke-Api -Method Get -Path "/crm/segments/$segmentId/customers"
  Write-Check "Segmento clientes" ($segCustomers.Count -ge 1)
} catch {
  Write-Check "Segmento clientes" $false $_.Exception.Message
}

Write-Host "== Fin ==" -ForegroundColor Cyan
