param(
    [string]$PostgresBin = 'E:\Psql\bin',
    [int]$ApiPort = 5081,
    [int]$DatabasePort = 55432
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runPath = Join-Path $projectRoot '.local-run\real-backend'
$dataPath = Join-Path $runPath 'postgres-data'
$secretPath = Join-Path $runPath 'server-secrets.dpapi'
$dotnet = Join-Path $projectRoot '.local-tools\dotnet\dotnet.exe'
if (!(Test-Path $dotnet)) { $dotnet = (Get-Command dotnet.exe).Source }
if (!(Test-Path (Join-Path $PostgresBin 'initdb.exe'))) { throw 'Set -PostgresBin to the installed PostgreSQL bin directory.' }
New-Item -ItemType Directory -Force $runPath | Out-Null
# Protect the persistent local key ring/passwords with Windows DPAPI, plus current-user ACLs.
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $runPath /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect local runtime directory.' }
function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); return [Convert]::ToBase64String($bytes) } finally { $rng.Dispose() }
}
if (!(Test-Path $secretPath)) {
    if (Test-Path (Join-Path $dataPath 'PG_VERSION')) { throw 'The existing local database needs its original DPAPI key file. Restore server-secrets.dpapi; no keys or data were replaced.' }
    $newSecrets = @{ DatabasePassword = (New-RandomSecret); JwtKey = (New-RandomSecret); EncryptionKey = (New-RandomSecret) }
    $protected = ConvertTo-SecureString ($newSecrets | ConvertTo-Json -Compress) -AsPlainText -Force
    ConvertFrom-SecureString $protected | Set-Content -LiteralPath $secretPath
}
$secure = (Get-Content -LiteralPath $secretPath -Raw).Trim() | ConvertTo-SecureString
$localSecrets = ([System.Net.NetworkCredential]::new('', $secure).Password) | ConvertFrom-Json
if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
    if ((Test-Path $dataPath) -and (Get-ChildItem -LiteralPath $dataPath -Force | Select-Object -First 1)) {
        throw 'An existing unrecognized data directory was found. Nothing has been deleted; inspect it manually.'
    }
    $passwordFile = Join-Path $runPath 'initdb-password.tmp'
    try {
        [IO.File]::WriteAllText($passwordFile, $localSecrets.DatabasePassword)
        & (Join-Path $PostgresBin 'initdb.exe') -D $dataPath -U buildmate_local --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL initialization failed.' }
    } finally { if (Test-Path $passwordFile) { Remove-Item -LiteralPath $passwordFile } }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') status -D $dataPath *> $null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $PostgresBin 'pg_ctl.exe') start -D $dataPath -l (Join-Path $runPath 'postgres.log') -o "-h 127.0.0.1 -p $DatabasePort" -w
    if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL did not start. Check postgres.log.' }
}
$env:PGPASSWORD = $localSecrets.DatabasePassword
try {
    $exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $DatabasePort -U buildmate_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='buildmate_local'"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect isolated local database.' }
    if ($exists -ne '1') {
        & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $DatabasePort -U buildmate_local buildmate_local
        if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated local database.' }
    }
} finally { Remove-Item Env:PGPASSWORD }
$pidPath = Join-Path $runPath 'api.pid'
if (Test-Path $pidPath) {
    $priorId = [int](Get-Content $pidPath)
    $prior = Get-CimInstance Win32_Process -Filter "ProcessId=$priorId"
    if ($prior -and $prior.CommandLine -like '*BuildMate.Api.dll*' -and $prior.CommandLine.Contains($projectRoot)) {
        Stop-Process -Id $priorId
    } elseif ($prior) { throw 'Saved PID belongs to another process; it was not stopped.' }
}
$env:DOTNET_CLI_HOME = Join-Path $projectRoot '.local-tools\dotnet-home'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$apiProject = Join-Path $projectRoot 'api\src\BuildMate.Api\BuildMate.Api.csproj'
& $dotnet build $apiProject --no-restore --nologo
if ($LASTEXITCODE -ne 0) { throw 'API build failed.' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = "http://127.0.0.1:$ApiPort"
$env:ConnectionStrings__Default = "Host=127.0.0.1;Port=$DatabasePort;Database=buildmate_local;Username=buildmate_local;Password=$($localSecrets.DatabasePassword)"
$env:Jwt__SigningKey = $localSecrets.JwtKey
$env:PaymentEncryption__ActiveKeyId = 'local-k1'
# Environment variables support the hyphen in the key ID using SetEnvironmentVariable.
[Environment]::SetEnvironmentVariable('PaymentEncryption__Keys__local-k1', $localSecrets.EncryptionKey, 'Process')
$env:Cashfree__Environment = 'sandbox'
$env:Cashfree__ClientId = ''
$env:Cashfree__ClientSecret = ''
$env:Cashfree__WebReturnUrl = 'http://127.0.0.1:3000/checkout/return?order={orderId}'
$env:Cashfree__NotifyUrl = ''
$env:Seed__DemoData = 'false'
$env:Database__AutoMigrate = 'true'
$env:Storage__LocalRoot = Join-Path $runPath 'storage'
$env:Storage__PublicBaseUrl = "http://127.0.0.1:$ApiPort/files"
$apiDirectory = Split-Path $apiProject -Parent
$assembly = Join-Path $apiDirectory 'bin\Debug\net8.0\BuildMate.Api.dll'
$process = Start-Process -FilePath $dotnet -ArgumentList ('"' + $assembly + '"') -WorkingDirectory $apiDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runPath 'api.log') -RedirectStandardError (Join-Path $runPath 'api-error.log') -PassThru
$process.Id | Set-Content $pidPath
Write-Output "Real .NET API starting at http://127.0.0.1:$ApiPort; isolated PostgreSQL at 127.0.0.1:$DatabasePort. No Cashfree credentials have been supplied."
