$zipRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Extracted package root: $zipRoot"
Write-Host "Copy these files into your project root:"
Write-Host " - app\api\youtube\live\route.ts"
Write-Host " - components\LiveBlock\LiveBlock.tsx"
