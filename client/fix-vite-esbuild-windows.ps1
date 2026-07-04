$ErrorActionPreference = "Stop"

$nodePath = "C:\Program Files\nodejs"
if (Test-Path $nodePath) {
  $env:Path = "$nodePath;$env:Path"
}

Write-Host "Cleaning frontend dependencies..."
if (Test-Path ".\node_modules") {
  Remove-Item -LiteralPath ".\node_modules" -Recurse -Force
}
if (Test-Path ".\package-lock.json") {
  Remove-Item -LiteralPath ".\package-lock.json" -Force
}
if (Test-Path ".\dist") {
  Remove-Item -LiteralPath ".\dist" -Recurse -Force
}

Write-Host "Installing dependencies with a project-local npm cache..."
npm install --cache .\.npm-cache

$esbuild = Get-ChildItem -Path ".\node_modules\@esbuild" -Recurse -Filter "esbuild.exe" | Select-Object -First 1
if ($esbuild) {
  Write-Host "Unblocking esbuild binary..."
  Unblock-File -LiteralPath $esbuild.FullName
  & $esbuild.FullName --version
}

Write-Host "Rebuilding esbuild..."
npm rebuild esbuild --cache .\.npm-cache

Write-Host "Testing Vite build..."
npm run build
