[CmdletBinding()]
param(
  [ValidateSet('prepare', 'test', 'status')]
  [string]$Action = 'test'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nodeVersion = '16.20.2'
$pnpmVersion = '8.15.9'
$nodeArchiveSha256 = 'f8bb35f6c08dc7bf14ac753509c06ed1a7ebf5b390cd3fbdc8f8c1aedd020ec3'
$runtimeRoot = Join-Path $PSScriptRoot '.test-runtime'
$nodeFolderName = "node-v$nodeVersion-win-x64"
$nodeDirectory = Join-Path $runtimeRoot $nodeFolderName
$nodeExecutable = Join-Path $nodeDirectory 'node.exe'
$nodeArchive = Join-Path $runtimeRoot "$nodeFolderName.zip"
$pnpmDirectory = Join-Path $runtimeRoot "pnpm-$pnpmVersion"
$pnpmScript = Join-Path $pnpmDirectory 'node_modules\pnpm\bin\pnpm.cjs'

function Test-RuntimeReady {
  return (Test-Path -LiteralPath $nodeExecutable) -and (Test-Path -LiteralPath $pnpmScript)
}

function Show-RuntimeStatus {
  if (-not (Test-RuntimeReady)) {
    Write-Output 'Node.js 16 test environment is not prepared.'
    return
  }

  $actualNodeVersion = & $nodeExecutable --version
  $actualPnpmVersion = & $nodeExecutable $pnpmScript --version
  Write-Output "Node.js $actualNodeVersion"
  Write-Output "pnpm $actualPnpmVersion"
  Write-Output "Runtime: $runtimeRoot"
}

function Install-TestRuntime {
  New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

  if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/$nodeFolderName.zip"
    Write-Output "Downloading Node.js v$nodeVersion..."
    Invoke-WebRequest -UseBasicParsing -Uri $nodeUrl -OutFile $nodeArchive
    $actualArchiveSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $nodeArchive).Hash.ToLowerInvariant()
    if ($actualArchiveSha256 -ne $nodeArchiveSha256) {
      throw "Node.js archive checksum mismatch. Expected $nodeArchiveSha256, got $actualArchiveSha256."
    }
    Expand-Archive -LiteralPath $nodeArchive -DestinationPath $runtimeRoot -Force
  }

  if (-not (Test-Path -LiteralPath $pnpmScript)) {
    Write-Output "Installing pnpm $pnpmVersion into the local test environment..."
    & (Join-Path $nodeDirectory 'npm.cmd') install `
      --prefix $pnpmDirectory `
      --no-audit `
      --no-fund `
      "pnpm@$pnpmVersion"
    if ($LASTEXITCODE -ne 0) {
      throw "Unable to install pnpm $pnpmVersion."
    }
  }

  if (-not (Test-RuntimeReady)) {
    throw 'Node.js 16 test environment is incomplete.'
  }
  Show-RuntimeStatus
}

if ($Action -eq 'status') {
  if (-not (Test-RuntimeReady)) {
    Show-RuntimeStatus
    throw 'Run .\test-node16.ps1 prepare before checking status.'
  }
  Show-RuntimeStatus
  return
}

if (-not (Test-RuntimeReady)) {
  Install-TestRuntime
} else {
  Show-RuntimeStatus | Out-Null
}

if ($Action -eq 'prepare') {
  Write-Output 'Node.js 16 test environment is ready.'
  return
}

$previousPath = $env:PATH
$previousCi = $env:CI
try {
  $env:PATH = "$nodeDirectory;$env:PATH"
  $env:CI = 'true'
  Write-Output 'Running pnpm test with the repository-local Node.js 16 environment...'
  & $nodeExecutable $pnpmScript test
  if ($LASTEXITCODE -ne 0) {
    throw "Node.js 16 test run failed with exit code $LASTEXITCODE."
  }
} finally {
  $env:PATH = $previousPath
  $env:CI = $previousCi
}
