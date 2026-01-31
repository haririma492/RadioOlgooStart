# inspect-project.ps1
# Run from repo root:  .\inspect-project.ps1
# Creates: project-inspect.txt

$ErrorActionPreference = "Stop"

$outFile = Join-Path (Get-Location) "project-inspect.txt"

function Write-Section($title) {
  "" | Out-File -FilePath $outFile -Append -Encoding utf8
  ("=" * 80) | Out-File -FilePath $outFile -Append -Encoding utf8
  $title | Out-File -FilePath $outFile -Append -Encoding utf8
  ("=" * 80) | Out-File -FilePath $outFile -Append -Encoding utf8
}

function List-Tree($path, $maxDepth = 5) {
  if (-not (Test-Path $path)) {
    "NOT FOUND: $path" | Out-File -FilePath $outFile -Append -Encoding utf8
    return
  }

  "TREE: $path (depth=$maxDepth)" | Out-File -FilePath $outFile -Append -Encoding utf8

  # Build a simple tree view by indenting based on relative depth
  $base = (Resolve-Path $path).Path
  Get-ChildItem -Path $base -Force -Recurse |
    Where-Object {
      # limit depth
      $rel = $_.FullName.Substring($base.Length).TrimStart('\','/')
      ($rel -split '[\\/]').Count -le $maxDepth
    } |
    Sort-Object FullName |
    ForEach-Object {
      $rel = $_.FullName.Substring($base.Length).TrimStart('\','/')
      $depth = ($rel -split '[\\/]').Count - 1
      $indent = "  " * [Math]::Max(0,$depth)
      $type = if ($_.PSIsContainer) { "[D]" } else { "[F]" }
      "$indent$type $rel" | Out-File -FilePath $outFile -Append -Encoding utf8
    }
}

Write-Section "BASIC PROJECT INFO"
"Root: $(Get-Location)" | Out-File -FilePath $outFile -Append -Encoding utf8

# Fixed for PowerShell 5.1 compatibility
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
"Node:  $(if ($nodeCmd) { $nodeCmd.Source } else { 'NOT FOUND' })" | Out-File -FilePath $outFile -Append -Encoding utf8
"npm:   $(if ($npmCmd) { $npmCmd.Source } else { 'NOT FOUND' })" | Out-File -FilePath $outFile -Append -Encoding utf8
"Time:  $(Get-Date -Format s)" | Out-File -FilePath $outFile -Append -Encoding utf8

Write-Section "KEY FILES (existence + location)"
$keys = @(
  "package.json",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json",
  "app\layout.tsx",
  "app\page.tsx",
  "src\app\layout.tsx",
  "src\app\page.tsx",
  "app\api\slides\route.ts",
  "src\app\api\slides\route.ts",
  "app\api\admin\presign\route.ts",
  "src\app\api\admin\presign\route.ts"
)

foreach ($k in $keys) {
  $p = Join-Path (Get-Location) $k
  if (Test-Path $p) {
    "FOUND: $k" | Out-File -FilePath $outFile -Append -Encoding utf8
  } else {
    "MISSING: $k" | Out-File -FilePath $outFile -Append -Encoding utf8
  }
}

Write-Section "TREE: app (depth 6)"
List-Tree -path (Join-Path (Get-Location) "app") -maxDepth 6

Write-Section "TREE: src\app (depth 6)"
List-Tree -path (Join-Path (Get-Location) "src\app") -maxDepth 6

Write-Section "ALL ROUTE HANDLERS (route.ts/route.js) and PAGES API"
$patterns = @("route.ts","route.js","route.tsx","route.jsx")
Get-ChildItem -Recurse -Force -File |
  Where-Object {
    $name = $_.Name.ToLower()
    ($patterns -contains $name) -or ($_.FullName -match "\\pages\\api\\")
  } |
  Sort-Object FullName |
  ForEach-Object {
    $_.FullName | Out-File -FilePath $outFile -Append -Encoding utf8
  }

Write-Section "DUPLICATE app vs src\app CHECK (same relative files)"
# Compare relative paths (helps catch both app/ and src/app existing)
$appRoot = Join-Path (Get-Location) "app"
$srcAppRoot = Join-Path (Get-Location) "src\app"

if ((Test-Path $appRoot) -and (Test-Path $srcAppRoot)) {
  $appFiles = Get-ChildItem -Recurse -File -Force $appRoot | ForEach-Object {
    $_.FullName.Substring($appRoot.Length).TrimStart('\','/')
  }
  $srcFiles = Get-ChildItem -Recurse -File -Force $srcAppRoot | ForEach-Object {
    $_.FullName.Substring($srcAppRoot.Length).TrimStart('\','/')
  }

  $common = $appFiles | Where-Object { $srcFiles -contains $_ } | Sort-Object
  if ($common.Count -gt 0) {
    "Found duplicate relative paths in BOTH app/ and src/app:" | Out-File -FilePath $outFile -Append -Encoding utf8
    $common | ForEach-Object { "  DUP: $_" | Out-File -FilePath $outFile -Append -Encoding utf8 }
  } else {
    "No duplicate relative paths between app/ and src/app." | Out-File -FilePath $outFile -Append -Encoding utf8
  }
} else {
  "Either app/ or src/app does not exist; no duplicate comparison done." | Out-File -FilePath $outFile -Append -Encoding utf8
}

Write-Section "DONE"
"Wrote: $outFile" | Out-File -FilePath $outFile -Append -Encoding utf8

Write-Host "Created: $outFile"
Write-Host "Attach/paste the contents here (or at least the sections about trees + route handlers)."