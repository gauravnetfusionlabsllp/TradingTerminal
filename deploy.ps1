# Deploy SGFX Terminal to PRODUCTION. The only place anything gets built.
# Run from the prod folder:   cd D:\deploy\sgfx-terminal; .\deploy.ps1            (latest committed master)
# Roll back / pin a release:  .\deploy.ps1 -Ref <commit-or-tag>
# Only committed code reaches prod: it fetches from the dev repo, never copies its working files.
param([string]$Ref = 'origin/master')
$ErrorActionPreference = 'Stop'
$Prod = 'D:\deploy\sgfx-terminal'

if ((Resolve-Path $PSScriptRoot).Path -ne $Prod) {
  throw "deploy.ps1 only runs from $Prod (this copy is $PSScriptRoot)"
}
Set-Location $Prod

function Run([string]$what) {
  Write-Host "`n> $what" -ForegroundColor Cyan
  Invoke-Expression $what
  if ($LASTEXITCODE -ne 0) { throw "failed: $what" }
}

Run 'git fetch origin'
Run "git checkout --detach $Ref"
Run 'npm ci'
Push-Location server
try {
  Run 'npx prisma generate'
} finally { Pop-Location }
Run 'npm run build'
Push-Location server
try {
  Run 'npx prisma migrate deploy'
} finally { Pop-Location }
Run 'pm2 restart sgfx-api --update-env'

Start-Sleep -Seconds 3
$health = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 'http://127.0.0.1:3001/api/health'
Write-Host "`nDeployed $(git log --oneline -1) — health $($health.StatusCode)" -ForegroundColor Green
