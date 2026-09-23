[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('menu', 'start', 'stop', 'status', 'open')]
  [string]$Command = 'menu',

  [ValidateRange(0, 65535)]
  [int]$Port = 0,

  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.git\regex-vis-dev-server'
$pidPath = Join-Path $runtimeDirectory 'server.pid'
$portPath = Join-Path $runtimeDirectory 'server.port'
$stdoutPath = Join-Path $runtimeDirectory 'stdout.log'
$stderrPath = Join-Path $runtimeDirectory 'stderr.log'
$vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$script:activePort = $Port

function Get-ServerUrl {
  return "http://127.0.0.1:$script:activePort"
}

function Get-ServerProcess {
  if (-not (Test-Path -LiteralPath $pidPath)) {
    Remove-Item -LiteralPath $portPath -Force -ErrorAction SilentlyContinue
    return $null
  }

  if (Test-Path -LiteralPath $portPath) {
    $storedPort = 0
    $portText = (Get-Content -Raw -LiteralPath $portPath).Trim()
    if ([int]::TryParse($portText, [ref]$storedPort)) {
      $script:activePort = $storedPort
    }
  }

  $storedProcessId = 0
  $pidText = (Get-Content -Raw -LiteralPath $pidPath).Trim()
  if (-not [int]::TryParse($pidText, [ref]$storedProcessId)) {
    Remove-Item -LiteralPath $pidPath, $portPath -Force -ErrorAction SilentlyContinue
    return $null
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $storedProcessId" -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    Remove-Item -LiteralPath $pidPath, $portPath -Force -ErrorAction SilentlyContinue
    return $null
  }

  $normalizedProjectRoot = $projectRoot.Replace('\', '/')
  $normalizedCommandLine = ([string]$process.CommandLine).Replace('\', '/')
  if (-not $normalizedCommandLine.Contains($normalizedProjectRoot) -or -not $normalizedCommandLine.Contains('vite/bin/vite.js')) {
    Write-Warning "PID $storedProcessId no longer belongs to this project; removing the stale PID file."
    Remove-Item -LiteralPath $pidPath, $portPath -Force -ErrorAction SilentlyContinue
    return $null
  }

  return $process
}

function Test-ServerReady {
  try {
    $response = Invoke-WebRequest -Uri (Get-ServerUrl) -Method Head -TimeoutSec 2 -UseBasicParsing
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  }
  catch {
    return $false
  }
}

function Get-DescendantProcessIds([int]$ParentProcessId) {
  $result = @()
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    $result += Get-DescendantProcessIds -ParentProcessId $child.ProcessId
    $result += [int]$child.ProcessId
  }
  return $result
}

function Get-AvailablePort {
  foreach ($candidate in 5173..5199) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue
    if ($null -eq $listener) {
      return $candidate
    }
  }
  throw 'No free development port was found between 5173 and 5199.'
}

function Invoke-ServerCommand([string]$Action) {
  & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath $Action
  $script:lastServerCommandExitCode = $LASTEXITCODE
}

switch ($Command) {
  'menu' {
    while ($true) {
      Clear-Host
      Write-Host '=================================================='
      Write-Host '             Regex Vis Development Server'
      Write-Host '=================================================='
      Write-Host
      Invoke-ServerCommand -Action 'status'
      Write-Host
      Write-Host '  [1] Start server'
      Write-Host '  [2] Stop server'
      Write-Host '  [3] Refresh status'
      Write-Host '  [4] Show logs'
      Write-Host '  [5] Install or repair dependencies'
      Write-Host '  [6] Open browser'
      Write-Host '  [0] Exit'
      Write-Host
      $choice = (Read-Host 'Choose an action').Trim()

      switch ($choice) {
        '1' { Invoke-ServerCommand -Action 'start' }
        '2' { Invoke-ServerCommand -Action 'stop' }
        '3' { Invoke-ServerCommand -Action 'status' }
        '4' {
          if (Test-Path -LiteralPath $stdoutPath) {
            Write-Host '---------------- stdout.log ----------------'
            Get-Content -LiteralPath $stdoutPath
          } else {
            Write-Host 'No stdout log is available yet.'
          }
          Write-Host
          if (Test-Path -LiteralPath $stderrPath) {
            Write-Host '---------------- stderr.log ----------------'
            Get-Content -LiteralPath $stderrPath
          } else {
            Write-Host 'No stderr log is available yet.'
          }
        }
        '5' {
          try {
            & pnpm install
            $script:lastServerCommandExitCode = $LASTEXITCODE
            if ($LASTEXITCODE -ne 0) {
              Write-Warning "Dependency installation failed with exit code $LASTEXITCODE."
            }
          }
          catch {
            $script:lastServerCommandExitCode = 1
            Write-Error "Could not run pnpm: $($_.Exception.Message)" -ErrorAction Continue
          }
        }
        '6' { Invoke-ServerCommand -Action 'open' }
        '0' { exit 0 }
        default { Write-Warning 'Enter a number from 0 to 6.' }
      }

      $openSucceeded = $choice -eq '6' -and $script:lastServerCommandExitCode -eq 0
      if ($choice -ne '0' -and -not $openSucceeded) {
        Write-Host
        [void](Read-Host 'Press C to return to the menu')
      }
    }
  }

  'open' {
    $running = Get-ServerProcess
    if ($null -eq $running) {
      throw 'Regex Vis is not running. Start it before opening the browser.'
    }
    Start-Process (Get-ServerUrl)
    exit 0
  }

  'start' {
    $running = Get-ServerProcess
    if ($null -ne $running) {
      Write-Host "Regex Vis is already running (PID $($running.ProcessId)): $(Get-ServerUrl)"
      exit 0
    }

    if (-not (Test-Path -LiteralPath $vitePath)) {
      throw 'Dependencies are missing. Run "pnpm install" first.'
    }

    if ($Port -eq 0) {
      $Port = Get-AvailablePort
      $script:activePort = $Port
    }
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($null -ne $listener) {
      throw "Port $Port is already in use. Omit -Port to choose a free port automatically."
    }

    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $quotedVitePath = '"' + $vitePath.Replace('"', '\"') + '"'
    $process = Start-Process `
      -FilePath $nodePath `
      -ArgumentList "$quotedVitePath --host 127.0.0.1 --port $Port --strictPort" `
      -WorkingDirectory $projectRoot `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -WindowStyle Hidden `
      -PassThru
    Set-Content -LiteralPath $pidPath -Value $process.Id
    Set-Content -LiteralPath $portPath -Value $Port

    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      if ($process.HasExited) {
        break
      }
      if (Test-ServerReady) {
        Start-Sleep -Milliseconds 100
        $process.Refresh()
        if ($process.HasExited) {
          break
        }
        $ready = $true
        break
      }
      Start-Sleep -Milliseconds 250
      $process.Refresh()
    }

    if (-not $ready) {
      Remove-Item -LiteralPath $pidPath, $portPath -Force -ErrorAction SilentlyContinue
      $details = if (Test-Path -LiteralPath $stderrPath) { (Get-Content -Raw -LiteralPath $stderrPath).Trim() } else { '' }
      throw "Regex Vis failed to become ready. $details"
    }

    Write-Host "Regex Vis started (PID $($process.Id)): $(Get-ServerUrl)"
    Write-Host "Logs: $stdoutPath"
    if ($OpenBrowser) {
      Start-Process (Get-ServerUrl)
    }
    exit 0
  }

  'stop' {
    $running = Get-ServerProcess
    if ($null -eq $running) {
      Write-Host 'Regex Vis is not running.'
      exit 0
    }

    $processIds = @(Get-DescendantProcessIds -ParentProcessId $running.ProcessId) + @([int]$running.ProcessId)
    foreach ($processId in $processIds) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidPath, $portPath -Force -ErrorAction SilentlyContinue
    Write-Host 'Regex Vis stopped.'
    exit 0
  }

  'status' {
    $running = Get-ServerProcess
    if ($null -eq $running) {
      Write-Host 'Regex Vis is stopped.'
      exit 1
    }

    $health = if (Test-ServerReady) { 'responding' } else { 'starting or not responding' }
    Write-Host "Regex Vis is running (PID $($running.ProcessId), $health): $(Get-ServerUrl)"
    exit 0
  }
}
