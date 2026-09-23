$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $PSScriptRoot
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("regex vis launcher test " + [guid]::NewGuid())

function Invoke-Launcher([string]$Launcher, [string]$Action) {
  $outputPath = Join-Path $testRoot "$Action-output.log"
  $errorPath = Join-Path $testRoot "$Action-error.log"
  $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    ('"' + $Launcher + '"'), $Action
  ) -RedirectStandardOutput $outputPath -RedirectStandardError $errorPath -PassThru -WindowStyle Hidden
  $process.WaitForExit()
  $process.Refresh()
  $output = ((Get-Content -Raw -LiteralPath $outputPath -ErrorAction SilentlyContinue) +
    (Get-Content -Raw -LiteralPath $errorPath -ErrorAction SilentlyContinue)).Trim()
  return @{ ExitCode = $process.ExitCode; Output = $output }
}

try {
  New-Item -ItemType Directory -Path $testRoot | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $testRoot '.git') | Out-Null
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'dev-server.ps1') -Destination $testRoot
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'regex-vis.cmd') -Destination $testRoot
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'index.html') -Destination $testRoot
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'vite.config.ts') -Destination $testRoot
  Copy-Item -LiteralPath (Join-Path $sourceRoot 'tsconfig.json') -Destination $testRoot
  New-Item -ItemType Junction -Path (Join-Path $testRoot 'node_modules') -Target (Join-Path $sourceRoot 'node_modules') | Out-Null

  $launcher = Join-Path $testRoot 'dev-server.ps1'
  $menuSource = Get-Content -Raw -LiteralPath $launcher
  if ($menuSource -notmatch "Read-Host 'Press C to return to the menu'") {
    throw 'Menu does not offer the required C return key.'
  }
  $start = Invoke-Launcher $launcher 'start'
  if ($start.Output -notmatch 'Regex Vis started') { throw "Unexpected start output: $($start.Output)" }

  $status = Invoke-Launcher $launcher 'status'
  if ($status.Output -notmatch 'Regex Vis is running') {
    throw "Status failed: $($status.Output)"
  }

  $stop = Invoke-Launcher $launcher 'stop'
  if ($stop.Output -notmatch 'Regex Vis stopped') {
    throw "Stop failed: $($stop.Output)"
  }

  Write-Output 'Launcher smoke test passed.'
}
finally {
  if (Test-Path -LiteralPath (Join-Path $testRoot 'dev-server.ps1')) {
    Invoke-Launcher (Join-Path $testRoot 'dev-server.ps1') 'stop' | Out-Null
  }
  Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
