param([ValidateSet('qwen3-vl:4b-instruct','qwen3-vl:2b-instruct','qwen3-vl:8b-instruct')][string]$Model='qwen3-vl:2b-instruct')
$ErrorActionPreference='Stop'
$ollamaCommand=Get-Command ollama -ErrorAction SilentlyContinue
if(-not $ollamaCommand){throw 'Install free Ollama from https://ollama.com/download/windows, then open a new PowerShell window and run this file again.'}
$pythonCommand=Get-Command py -ErrorAction SilentlyContinue
$pythonPrefix=@('-3')
if(-not $pythonCommand){$pythonCommand=Get-Command python -ErrorAction SilentlyContinue;$pythonPrefix=@()}
if(-not $pythonCommand){throw 'Python 3.10+ is required. Install it from https://www.python.org/downloads/windows/.'}
& $pythonCommand.Source @pythonPrefix -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ required"'
if($LASTEXITCODE -ne 0){throw 'A working Python 3.10+ installation is required.'}
$helperPath=Join-Path $PSScriptRoot 'noc_lab_ai.py'
$helperHash='fd9a4fbb26780ddd6312f3c691f42f231194afb41d64b46191ea006b4f2c001f'
if(-not (Test-Path -LiteralPath $helperPath)){Invoke-WebRequest -Uri 'https://giorgikukulava.vercel.app/static/agent/noc_lab_ai.py' -OutFile $helperPath}
if((Get-FileHash -Algorithm SHA256 -LiteralPath $helperPath).Hash.ToLowerInvariant() -ne $helperHash){throw 'Local helper checksum does not match this launcher. Download the latest helper and launcher together from the website.'}
$env:OLLAMA_HOST='127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD='1'
$startedServer=$null
try{
 try{Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2 | Out-Null}catch{
  $startedServer=Start-Process -FilePath $ollamaCommand.Source -ArgumentList 'serve' -WindowStyle Hidden -PassThru
  $ready=$false
  for($attempt=0;$attempt -lt 20;$attempt++){try{Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 1 | Out-Null;$ready=$true;break}catch{Start-Sleep -Milliseconds 500}}
  if(-not $ready){throw 'Local Ollama did not start.'}
 }
 Write-Host 'Preparing the free local vision model. Initial download is several GB; no paid API is used.'
 & $ollamaCommand.Source pull $Model
 if($LASTEXITCODE -ne 0){throw 'Local model download failed. Check internet/disk space and retry.'}
 & $pythonCommand.Source @pythonPrefix $helperPath
}finally{if($startedServer -and -not $startedServer.HasExited){Stop-Process -Id $startedServer.Id -ErrorAction SilentlyContinue}}
