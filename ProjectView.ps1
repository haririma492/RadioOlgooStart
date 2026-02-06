# ProjectView.ps1 - Idempotent project file viewer

$sourceRoot = "."
$outputFolder = "ProjectView_Output"

# Clear and recreate output folder
if (Test-Path $outputFolder) {
    Remove-Item $outputFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $outputFolder | Out-Null

Write-Host "Collecting project files..." -ForegroundColor Cyan

# Define file patterns
$patterns = @("route.ts", "page.tsx", "layout.tsx", "*.api.ts")

# Find all matching files
$files = Get-ChildItem -Path $sourceRoot -Recurse -Include $patterns | Where-Object { 
    $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.next*" 
}

$fileCount = 0

foreach ($file in $files) {
    $fileCount++
    
    # Get relative path
    $fullSourcePath = (Resolve-Path $sourceRoot).Path
    $relativePath = $file.FullName.Substring($fullSourcePath.Length).TrimStart('\').TrimStart('/')
    
    # Create flat filename
    $outputFileName = "{0:D3}_{1}" -f $fileCount, $file.Name
    $outputPath = Join-Path $outputFolder $outputFileName
    
    # Write path comment + original content
    $headerComment = "// Original: " + $relativePath
    $headerComment | Out-File -FilePath $outputPath -Encoding UTF8
    Get-Content $file.FullName | Add-Content -Path $outputPath -Encoding UTF8
    
    Write-Host "  OK: $relativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Complete! Copied $fileCount files to $outputFolder" -ForegroundColor Green