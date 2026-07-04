$nodeDir = "C:\Program Files\nodejs"

if (!(Test-Path "$nodeDir\npm.cmd")) {
  Write-Error "npm.cmd was not found at $nodeDir. Reinstall Node.js LTS from https://nodejs.org."
  exit 1
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ([string]::IsNullOrWhiteSpace($userPath)) {
  $userPath = ""
}

$parts = $userPath -split ";" | Where-Object { $_ }
if ($parts -notcontains $nodeDir) {
  $newPath = (@($parts) + $nodeDir) -join ";"
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  Write-Host "Added $nodeDir to your user PATH."
} else {
  Write-Host "$nodeDir is already in your user PATH."
}

Write-Host "Close PowerShell, open a new PowerShell window, then run: npm -v"
