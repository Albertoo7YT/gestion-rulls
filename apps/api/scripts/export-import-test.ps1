param(
  [string]$ApiUrl = "http://localhost:3001"
)

$exportPath = Join-Path $PSScriptRoot "export.zip"

Write-Host "Exporting..."
Invoke-WebRequest -Uri "$ApiUrl/export" -OutFile $exportPath

Write-Host "Importing (merge)..."
& curl.exe -sS -X POST "$ApiUrl/import?mode=merge" -F "file=@$exportPath" | Write-Host

Write-Host "Importing (restore)..."
& curl.exe -sS -X POST "$ApiUrl/import?mode=restore" -F "file=@$exportPath" | Write-Host

Write-Host "Done."
