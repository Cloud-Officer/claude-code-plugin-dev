# Windows twin of db-tunnel.sh: opens, reuses and closes the ssm-jump tunnels declared by <ENGINE>_TUNNEL_<ENV>.
#   db-tunnel.ps1 ensure <engine> <env> [read|write]
#   db-tunnel.ps1 close <engine> <env> [read|write]
#   db-tunnel.ps1 close-all
#   db-tunnel.ps1 list
# Runs on Windows PowerShell 5.1 and PowerShell 7. Connection values are checked, never printed.

param(
  [string]$Action = '',
  [string]$Engine = '',
  [string]$EnvName = '',
  [string]$Mode = 'read'
)

$ErrorActionPreference = 'Stop'

$StateDir = Join-Path $env:LOCALAPPDATA 'co-dev\db-tunnels'
$WaitSeconds = 45
if ($env:DB_TUNNEL_WAIT) { $WaitSeconds = [int]$env:DB_TUNNEL_WAIT }

function Fail([string]$Message) {
  Write-Output "ERROR: $Message"
  exit 1
}

function Get-EnvValue([string]$Name) {
  [Environment]::GetEnvironmentVariable($Name)
}

function Get-FirstSet([string[]]$Names) {
  foreach ($name in $Names) {
    $value = Get-EnvValue $name
    if ($value) { return $value }
  }
  return $null
}

function Test-Port([int]$Port) {
  $client = New-Object Net.Sockets.TcpClient
  try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(1000) } catch { return $false } finally { $client.Dispose() }
}

function Get-Identity([int]$ProcessId) {
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  try { return "$($process.ProcessName) $($process.StartTime.ToUniversalTime().ToString('o'))" } catch { return $null }
}

function Get-Tree([int]$ProcessId) {
  $seen = @{}
  $queue = New-Object Collections.Queue
  $queue.Enqueue($ProcessId)
  while ($queue.Count -gt 0) {
    $current = [int]$queue.Dequeue()
    if ($current -lt 2 -or $seen.ContainsKey($current)) { continue }
    $seen[$current] = $true
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue | ForEach-Object { $queue.Enqueue([int]$_.ProcessId) }
  }
  return @($seen.Keys)
}

function Stop-Tunnel([int]$ProcessId, [int]$Port) {
  $tree = Get-Tree $ProcessId
  foreach ($member in $tree) { Stop-Process -Id $member -Force -ErrorAction SilentlyContinue }
  foreach ($i in 1..5) {
    if (-not (Test-Port $Port)) { return $true }
    Start-Sleep 1
  }
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Where-Object { $tree -contains [int]$_.OwningProcess } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  return -not (Test-Port $Port)
}

function Read-State([string]$File) {
  $lines = @(Get-Content $File -TotalCount 2)
  if ($lines.Count -eq 0) { return $null }
  $parts = @("$($lines[0])".Trim() -split ' +')
  $id = 0
  $port = 0
  if ($parts.Count -lt 2 -or -not [int]::TryParse($parts[0], [ref]$id) -or $id -lt 2 -or -not [int]::TryParse($parts[1], [ref]$port)) { return $null }
  $identity = if ($lines.Count -gt 1) { "$($lines[1])" } else { '' }
  return @{ Pid = $id; Port = $port; Identity = $identity }
}

function Test-Ours($State) {
  return [bool]($State -and $State.Identity -and (Get-Identity $State.Pid) -eq $State.Identity)
}

function Close-State([string]$File) {
  $label = [IO.Path]::GetFileNameWithoutExtension($File)
  $state = Read-State $File
  if (-not (Test-Ours $state)) {
    Write-Output "NOT-OURS: the recorded $label process is gone or is no longer the tunnel this skill started; dropped the record and killed nothing"
  } elseif (Stop-Tunnel $state.Pid $state.Port) {
    Write-Output "CLOSED: $label tunnel on 127.0.0.1:$($state.Port)"
  } else {
    Write-Output "WARNING: $label tunnel on 127.0.0.1:$($state.Port) is still listening after kill"
  }
  Remove-Item $File -Force -ErrorAction SilentlyContinue
}

function Get-StateFiles {
  if (-not (Test-Path $StateDir)) { return @() }
  return @(Get-ChildItem $StateDir -Filter '*.pid' | ForEach-Object { $_.FullName })
}

$usage = 'usage: db-tunnel.ps1 ensure|close <mysql|pg|mongodb|redis|es> <env> [read|write] | close-all | list'

switch ($Action) {
  'list' {
    foreach ($file in Get-StateFiles) {
      $state = Read-State $file
      if (-not $state) { continue }
      $status = if (Test-Port $state.Port) { 'open' } else { 'closed' }
      Write-Output "$([IO.Path]::GetFileNameWithoutExtension($file)) 127.0.0.1:$($state.Port) pid=$($state.Pid) $status"
    }
    exit 0
  }
  'close-all' {
    $files = Get-StateFiles
    foreach ($file in $files) { Close-State $file }
    if ($files.Count -eq 0) { Write-Output 'NONE: no tunnel started by this skill is recorded' }
    exit 0
  }
  'ensure' { }
  'close' { }
  default { Fail $usage }
}

if (-not $Engine -or -not $EnvName) { Fail $usage }
if ($Engine -cnotmatch '^(mysql|pg|mongodb|redis|es)$') { Fail "unknown engine '$Engine' (mysql, pg, mongodb, redis or es)" }
if ($Mode -cnotmatch '^(read|write)$') { Fail 'mode must be read or write' }
if ($EnvName -cnotmatch '^[a-z0-9]+$') { Fail 'environment name must match ^[a-z0-9]+$' }
if (" $(Get-EnvValue 'DB_ENVS') " -notlike "* $EnvName *") { Fail "'$EnvName' is not listed in DB_ENVS" }

$ENV_UP = $EnvName.ToUpperInvariant()
$ENGINE_UP = $Engine.ToUpperInvariant()
$label = "$EnvName-$Engine"
if ($Mode -eq 'write') { $label = "$label-write" }
$stateFile = Join-Path $StateDir "$label.pid"
$logFile = Join-Path $StateDir "$label.log"
$errFile = Join-Path $StateDir "$label.err.log"

if ($Action -eq 'close') {
  if (Test-Path $stateFile) { Close-State $stateFile } else { Write-Output "NOT-OURS: no $label tunnel was started by this skill; leaving any open one alone" }
  exit 0
}

$tunnelVar = "${ENGINE_UP}_TUNNEL_${ENV_UP}"
$suffixes = @("_$ENV_UP", '')
if ($Mode -eq 'write') {
  if (Get-EnvValue "${tunnelVar}_WRITE") { $tunnelVar = "${tunnelVar}_WRITE" }
  $suffixes = @("_${ENV_UP}_WRITE", "_$ENV_UP", '')
}

$tunnel = Get-EnvValue $tunnelVar
if (-not $tunnel) {
  Write-Output "NONE: $tunnelVar is not set, so no tunnel is managed for $Engine on $EnvName"
  exit 0
}

if ($tunnel -cnotmatch '^ssm-jump( +[A-Za-z0-9._:@/=-]+)+$') { Fail "$tunnelVar is not a plain 'ssm-jump <args>' command; not running it" }

$tunnelArgs = @(($tunnel -split ' +') | Select-Object -Skip 1)
$forward = ''
$profileName = ''
for ($i = 0; $i -lt $tunnelArgs.Count; $i++) {
  if ($tunnelArgs[$i] -eq '--forward' -and $i + 1 -lt $tunnelArgs.Count) { $forward = $tunnelArgs[$i + 1] }
  elseif ($tunnelArgs[$i] -like '--forward=*') { $forward = $tunnelArgs[$i].Substring(10) }
  elseif ($tunnelArgs[$i] -eq '--profile' -and $i + 1 -lt $tunnelArgs.Count) { $profileName = $tunnelArgs[$i + 1] }
}

if ($forward -cnotmatch '^[A-Za-z0-9._-]+:[0-9]+:[0-9]+$') { Fail "$tunnelVar has no '--forward <host>:<remote_port>:<local_port>'" }
$port = [int]($forward -split ':')[-1]

$bases = switch ($Engine) {
  'mysql' { @('MYSQL_PORT') }
  'pg' { @('PGPORT') }
  'mongodb' { @('MONGODB_URI') }
  'redis' { @('REDIS_URL', 'CACHE_DSN') }
  'es' { @('ES_URL') }
}
$names = @(foreach ($suffix in $suffixes) { foreach ($base in $bases) { "$base$suffix" } })
$value = Get-FirstSet $names
if (-not $value) { Fail "none of $($names -join ' ') is set" }

if ($Engine -eq 'mysql' -or $Engine -eq 'pg') {
  if ($value -ne "$port") { Fail "$tunnelVar forwards to local port $port but $($names[0]) (or its fallback) is $value" }
} elseif ($value -notmatch ":$port([/?,]|$)") {
  Fail "$tunnelVar forwards to local port $port but $($names[0]) (or its fallback) does not use that port"
}

function Write-MongoWarnings {
  if ($Engine -ne 'mongodb') { return }
  if ($value -match '[?&]replicaSet=' -and $value -notmatch '[?&]directConnection=true') {
    Write-Output "WARN: $($names[0]) sets replicaSet without directConnection=true; through a tunnel the driver follows the replica set to unreachable hosts"
  }
  if ($value -match '[?&](tls|ssl)=true' -and $value -notmatch '[?&](tlsAllowInvalidHostnames|tlsInsecure)=true') {
    Write-Output "WARN: $($names[0]) uses TLS without tlsAllowInvalidHostnames=true; the server certificate will not match 127.0.0.1"
  }
}

$startedByUs = ''
if (Test-Path $stateFile) {
  $old = Read-State $stateFile
  if (Test-Ours $old) { $startedByUs = " (started earlier by this skill, pid $($old.Pid))" }
}

if (Test-Port $port) {
  if (-not $startedByUs) { $startedByUs = ' (not started by this skill; it will be left open)' }
  Write-Output "OPEN: $EnvName $Engine tunnel already up on 127.0.0.1:$port$startedByUs"
  Write-MongoWarnings
  exit 0
}

$verb = 'OPENED'
if (Test-Path $stateFile) {
  $verb = 'REOPENED'
  $old = Read-State $stateFile
  if (Test-Ours $old) { [void](Stop-Tunnel $old.Pid $old.Port) }
  Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
}

$command = Get-Command ssm-jump -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $command) { Fail 'ssm-jump is not recognized; run the ci-tools Windows installer (https://github.com/Cloud-Officer/ci-tools#windows-installation) or add %USERPROFILE%\bin to the user PATH' }

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$process = Start-Process -FilePath $command.Source -ArgumentList $tunnelArgs -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru
Set-Content -Path $stateFile -Value @("$($process.Id) $port", "$(Get-Identity $process.Id)")

$waited = 0
while ($waited -lt $WaitSeconds) {
  if (Test-Port $port) {
    Write-Output "${verb}: $EnvName $Engine tunnel on 127.0.0.1:$port (pid $($process.Id), log $logFile)"
    Write-MongoWarnings
    exit 0
  }
  if ($process.HasExited) { break }
  Start-Sleep 1
  $waited++
}

[void](Stop-Tunnel $process.Id $port)
Remove-Item $stateFile -Force -ErrorAction SilentlyContinue

Write-Output "ERROR: $EnvName $Engine tunnel did not open on 127.0.0.1:$port within ${waited}s"
Write-Output "--- last lines of ssm-jump output ($logFile, $errFile) ---"
$output = @()
foreach ($file in @($logFile, $errFile)) {
  if (Test-Path $file) { $output += Get-Content $file -Tail 20 }
}
$output | Write-Output

$text = $output -join "`n"
if ($text -match 'sso|token (has )?expired|expired token|UnauthorizedSSOTokenError|Error loading SSO') {
  $profileHint = if ($profileName) { " --profile $profileName" } else { '' }
  $profileLabel = if ($profileName) { $profileName } else { 'default' }
  Write-Output "HINT: SSO_EXPIRED profile=$profileLabel - run: aws sso login$profileHint"
} elseif ($text -match 'select|choose|#\?') {
  Write-Output "HINT: INSTANCE_PROMPT - add -a <instance> to $tunnelVar so ssm-jump never asks"
}

exit 1
