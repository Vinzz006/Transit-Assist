# Transit Assist India — Live CLI Demonstration Script (PowerShell)
# Target City: Chennai (MTC Buses + CMRL Metro)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check Python in venv first, then system python
$venvPython = Join-Path $scriptDir "backend\.venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    & $venvPython demo.py
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python demo.py
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py demo.py
} else {
    Write-Host "Python not found in backend\.venv or system PATH." -ForegroundColor Red
    Write-Host "Please visit http://localhost:5174 for the Web App or http://localhost:8000/docs for API docs." -ForegroundColor Yellow
}
