param(
    [switch]$SkipFrontend,
    [switch]$SkipInstall,
    [switch]$BackendOnly
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Info($m) { Write-Host "  >> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !! $m" -ForegroundColor Yellow }
function Err($m)  { Write-Host "  ERROR: $m" -ForegroundColor Red }
function Step($m) { Write-Host "" ; Write-Host "--- $m ---" -ForegroundColor White }

Write-Host ""
Write-Host "  Waste-to-Energy Platform  Setup + Start" -ForegroundColor Green
Write-Host ""

Step "Checking Python"
$python = $null
foreach ($cmd in @("python","python3","py")) {
    try {
        $v = (& $cmd --version 2>&1).ToString()
        if ($v -match "Python 3\.(\d+)" -and [int]$Matches[1] -ge 9) {
            $python = $cmd
            Ok $v
            break
        }
    } catch {}
}
if (-not $python) {
    Err "Python 3.9+ not found. Install from https://python.org"
    exit 1
}

Step "Virtual environment"
$venvDir    = Join-Path $Root "venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$pip        = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Info "Creating venv..."
    & $python -m venv $venvDir
    Ok "venv created"
} else {
    Ok "venv already exists"
}

$activatePs1 = Join-Path $venvDir "Scripts\Activate.ps1"
if (Test-Path $activatePs1) {
    . $activatePs1
}

if (-not $SkipInstall) {
    Step "Installing Python dependencies"
    $req = Join-Path $Root "requirements.txt"
    if (Test-Path $req) {
        Info "pip install -r requirements.txt ..."
        & $pip install -r $req --quiet --no-warn-script-location
        Ok "Python packages ready"
    } else {
        Warn "requirements.txt not found"
    }

    $clipOk = (& $venvPython -c "import open_clip; print('ok')" 2>&1).ToString().Trim()
    if ($clipOk -ne "ok") {
        Info "Installing open-clip-torch..."
        & $pip install open-clip-torch --quiet --no-warn-script-location
        Ok "open-clip-torch installed"
    } else {
        Ok "open-clip-torch already installed"
    }
} else {
    Warn "Skipping install (-SkipInstall flag set)"
}

Step "YOLO segmentation model"
$modelsDir = Join-Path $Root "models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir | Out-Null
}
$modelDest = Join-Path $modelsDir "yolov8s-seg.pt"

if (Test-Path $modelDest) {
    Ok "yolov8s-seg.pt already present in models/"
} else {
    Info "Downloading yolov8s-seg.pt (~22 MB) ..."
    $dlUrl = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s-seg.pt"
    try {
        Invoke-WebRequest -Uri $dlUrl -OutFile $modelDest -UseBasicParsing
        Ok "Saved to models/yolov8s-seg.pt"
    } catch {
        Warn "Direct download failed. Trying via ultralytics Python..."
        $pyLine = "from ultralytics import YOLO; import shutil; m=YOLO('yolov8s-seg.pt'); shutil.copy2(m.ckpt_path, r'" + $modelDest + "'); print('done')"
        $r = (& $venvPython -c $pyLine 2>&1).ToString()
        if ($r -match "done") {
            Ok "Model downloaded via ultralytics"
        } else {
            Warn "Could not download automatically."
            Warn "Download manually: $dlUrl"
            Warn "Place the file in: $modelsDir"
        }
    }
}

Step "Required directories"
foreach ($d in @("uploads","reports","static")) {
    $p = Join-Path $Root $d
    if (-not (Test-Path $p)) {
        New-Item -ItemType Directory -Path $p | Out-Null
        Ok "Created $d"
    }
}
Ok "Directories ready"

$frontendDir = Join-Path $Root "frontend"
$runFrontend = (-not $SkipFrontend) -and (-not $BackendOnly) -and (Test-Path $frontendDir)

if ($runFrontend) {
    Step "Frontend (Next.js)"
    $nodeFound = $false
    try {
        $nv = (node --version 2>&1).ToString()
        Ok "Node.js $nv"
        $nodeFound = $true
    } catch {
        Warn "Node.js not found - skipping frontend. Install from https://nodejs.org"
        $runFrontend = $false
    }

    if ($nodeFound -and (-not $SkipInstall)) {
        $nm = Join-Path $frontendDir "node_modules"
        if (-not (Test-Path $nm)) {
            Info "npm install (first run, ~1 min)..."
            Push-Location $frontendDir
            npm install --silent
            Pop-Location
            Ok "npm packages installed"
        } else {
            Ok "node_modules already present"
        }
    }
}

Step "Launching"

$backendJob = Start-Job -ScriptBlock {
    param($root, $py)
    Set-Location $root
    $ErrorActionPreference = "SilentlyContinue"
    & $py run.py 2>&1
} -ArgumentList $Root, $venvPython

$frontendJob = $null
if ($runFrontend) {
    Start-Sleep -Seconds 2
    $frontendJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        $ErrorActionPreference = "SilentlyContinue"
        npm run dev 2>&1
    } -ArgumentList $frontendDir
}

Write-Host ""
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor Green
if ($runFrontend) {
    Write-Host "  Frontend -> http://localhost:3000" -ForegroundColor Green
}
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

function PrintLines($prefix, $items, $errColor, $warnColor, $okColor, $baseColor) {
    foreach ($item in $items) {
        if ($item -is [System.Management.Automation.ErrorRecord]) {
            $s = $item.Exception.Message
        } else {
            $s = $item.ToString()
        }
        if ($s.Trim() -eq "") { continue }
        if ($s -match "Traceback|Error") {
            Write-Host "  [$prefix] $s" -ForegroundColor $errColor
        } elseif ($s -match "WARNING|warning") {
            Write-Host "  [$prefix] $s" -ForegroundColor $warnColor
        } elseif ($s -match "startup complete|loaded|ready|Local:") {
            Write-Host "  [$prefix] $s" -ForegroundColor $okColor
        } else {
            Write-Host "  [$prefix] $s" -ForegroundColor $baseColor
        }
    }
}

try {
    while ($true) {
        PrintLines "back"  (Receive-Job $backendJob  -ErrorAction SilentlyContinue) "Red" "Yellow" "Green" "DarkGray"
        if ($frontendJob) {
            PrintLines "front" (Receive-Job $frontendJob -ErrorAction SilentlyContinue) "Red" "Yellow" "Green" "DarkGray"
        }

        if ($backendJob.State -eq "Failed") {
            Err "Backend crashed - check output above"
            break
        }

        Start-Sleep -Milliseconds 600
    }
} finally {
    Write-Host ""
    Write-Host "  Shutting down..." -ForegroundColor Yellow
    if ($backendJob) {
        Stop-Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job $backendJob -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -ErrorAction SilentlyContinue
    }
    Write-Host "  Done." -ForegroundColor Green
}
