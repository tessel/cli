echo 'begin tessel cli install...'

Function Test-CommandExists
{
 Param ($command)
 $oldPreference = $ErrorActionPreference
 $ErrorActionPreference = 'stop'
 try {if(Get-Command $command){1}}
 Catch {0}
 Finally {$ErrorActionPreference=$oldPreference}
} #end function test-CommandExists

if (!(Test-CommandExists node) -or ((node -v) -match "^v?0\.[0-7]\.")) {
	$node_version = if (Test-CommandExists node) { node -v }
	Write-Host "You need node 0.8+ installed to install tessel (node --version reports: $node_version)"
 	Write-Host "Please install node 0.8+ and try again."
 	exit 1
}

if (!(Test-CommandExists npm)) {
	Write-Host "You need npm installed to install tessel."
 	Write-Host "Please install npm along with node 0.8+ and try again."
 	exit 1
}

$tesseltemp = [System.Guid]::NewGuid().ToString()
Set-Location $env:temp
new-item -type directory -name $tesseltemp
set-location $tesseltemp

$tarpath = Join-Path $pwd "tessel-cli.tar.gz"
$url = [uri]'https://s3.amazonaws.com/tessel-tools/cli/tessel-cli.tar.gz'

$webclient = New-Object System.Net.WebClient
$webclient.DownloadFile($url, $tarpath)

npm install -g --no-registry --loglevel=info --ignore-scripts .\tessel-cli.tar.gz 
cd "$(npm -g prefix)\node_modules\tessel"
npm rebuild

# Classy signoff
echo ''
echo '#########################################'
echo ' Successfully installed Tessel CLI!'
echo ' Try running "tessel" from your command'
echo ' line, and "tessel logs" when a Tessel'
echo ' is connected to your computer.'
echo ' #tessellives'
echo '#########################################'

