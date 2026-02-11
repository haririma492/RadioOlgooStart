# InspectProject.ps1
# Run from repo root:  .\InspectProject.ps1
#
# Creates/uses: .\ProjectInspect\  (flat copy of all .ts/.tsx files)
# Creates/overwrites: .\ProjectInspect\project-inspect.txt
#
# Idempotent:
# - Copies only when destination missing OR content differs (SHA1 mismatch)
# - Always overwrites project-inspect.txt with a fresh run

$ErrorActionPreference = "Stop"

# ----------------------------
# Output folder + output file
# ----------------------------
$repoRoot = (Resolve-Path (Get-Location)).Path
$projectInspectDir = Join-Path $repoRoot "ProjectInspect"
if (-not (Test-Path $projectInspectDir)) {
  New-Item -ItemType Directory -Path $projectInspectDir | Out-Null
}

$outFile = Join-Path $projectInspectDir "project-inspect.txt"

# Overwrite output file every run
if (Test-Path $outFile) { Remove-Item $outFile -Force }

# ----------------------------
# Helpers
# ----------------------------
function Write-Section([string]$title) {
  "" | Out-File -FilePath $outFile -Append -Encoding utf8
  ("=" * 80) | Out-File -FilePath $outFile -Append -Encoding utf8
  $title | Out-File -FilePath $outFile -Append -Encoding utf8
  ("=" * 80) | Out-File -FilePath $outFile -Append -Encoding utf8
}

function List-Tree([string]$path, [int]$maxDepth = 5) {
  if (-not (Test-Path $path)) {
    "NOT FOUND: $path" | Out-File -FilePath $outFile -Append -Encoding utf8
    return
  }

  "TREE: $path (depth=$maxDepth)" | Out-File -FilePath $outFile -Append -Encoding utf8

  $base = (Resolve-Path $path).Path
  Get-ChildItem -Path $base -Force -Recurse |
    Where-Object {
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

function ShortHash8([string]$s) {
  $sha1 = New-Object System.Security.Cryptography.SHA1Managed
  $bytes = [Text.Encoding]::UTF8.GetBytes($s)
  return ([BitConverter]::ToString($sha1.ComputeHash($bytes)).Replace("-", "").Substring(0,8)).ToLower()
}

function FileSha1([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  return (Get-FileHash -Algorithm SHA1 -LiteralPath $path).Hash.ToLower()
}

# ----------------------------
# BASIC PROJECT INFO
# ----------------------------
Write-Section "BASIC PROJECT INFO"
"Root: $repoRoot" | Out-File -FilePath $outFile -Append -Encoding utf8

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$npmCmd  = Get-Command npm  -ErrorAction SilentlyContinue
"Node:  $(if ($nodeCmd) { $nodeCmd.Source } else { 'NOT FOUND' })" | Out-File -FilePath $outFile -Append -Encoding utf8
"npm:   $(if ($npmCmd)  { $npmCmd.Source  } else { 'NOT FOUND' })" | Out-File -FilePath $outFile -Append -Encoding utf8
"Time:  $(Get-Date -Format s)" | Out-File -FilePath $outFile -Append -Encoding utf8
"ProjectInspect: $projectInspectDir" | Out-File -FilePath $outFile -Append -Encoding utf8

# ----------------------------
# KEY FILES (CHECKLIST ONLY)
# ----------------------------
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
  $p = Join-Path $repoRoot $k
  if (Test-Path $p) {
    "FOUND: $k" | Out-File -FilePath $outFile -Append -Encoding utf8
  } else {
    "MISSING: $k" | Out-File -FilePath $outFile -Append -Encoding utf8
  }
}

# ----------------------------
# TREES
# ----------------------------
Write-Section "TREE: app (depth 6)"
List-Tree -path (Join-Path $repoRoot "app") -maxDepth 6

Write-Section "TREE: src\app (depth 6)"
List-Tree -path (Join-Path $repoRoot "src\app") -maxDepth 6

# ----------------------------
# ROUTE HANDLERS
# ----------------------------
Write-Section "ALL ROUTE HANDLERS (route.ts/route.js/route.tsx/route.jsx) and PAGES API"
$patterns = @("route.ts","route.js","route.tsx","route.jsx")
Get-ChildItem -Path $repoRoot -Recurse -Force -File |
  Where-Object {
    $name = $_.Name.ToLower()
    ($patterns -contains $name) -or ($_.FullName -match "\\pages\\api\\")
  } |
  Sort-Object FullName |
  ForEach-Object {
    $_.FullName | Out-File -FilePath $outFile -Append -Encoding utf8
  }

# ----------------------------
# DUPLICATE app vs src\app
# ----------------------------
Write-Section "DUPLICATE app vs src\app CHECK (same relative files)"
$appRoot    = Join-Path $repoRoot "app"
$srcAppRoot = Join-Path $repoRoot "src\app"

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

# ----------------------------
# FLAT COPY (IDEMPOTENT) + LIST EACH FILE
# ----------------------------
Write-Section "FLAT COPY (IDEMPOTENT): ALL .ts/.tsx INTO ProjectInspect (flat)"

# Collect all .ts and .tsx files (excluding node_modules, ProjectInspect, .next)
$tsFiles = Get-ChildItem -Path $repoRoot -Recurse -Force -File -Include *.ts,*.tsx |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\ProjectInspect\\" -and
    $_.FullName -notmatch "\\\.next\\"
  } |
  Sort-Object FullName

"Found $($tsFiles.Count) TypeScript files (.ts/.tsx)." | Out-File -FilePath $outFile -Append -Encoding utf8
Write-Host "Found $($tsFiles.Count) .ts/.tsx files. Idempotent copy -> $projectInspectDir"

# Stable destination naming:
# - Unique filename => same name
# - Collision => add __<hash8(relativePath)>
$nameGroups = $tsFiles | Group-Object Name

$copied = 0
$skipped = 0

foreach ($g in $nameGroups) {
  $isCollision = ($g.Count -gt 1)

  foreach ($f in $g.Group) {
    $rel = $f.FullName.Substring($repoRoot.Length).TrimStart('\','/')

    $destName = $f.Name
    if ($isCollision) {
      $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)
      $ext  = [IO.Path]::GetExtension($f.Name)
      $h    = ShortHash8 $rel
      $destName = "${base}__${h}${ext}"
    }

    $destPath = Join-Path $projectInspectDir $destName

    $srcHash = (Get-FileHash -Algorithm SHA1 -LiteralPath $f.FullName).Hash.ToLower()
    $dstHash = FileSha1 $destPath

    if (($null -eq $dstHash) -or ($dstHash -ne $srcHash)) {
      Copy-Item -LiteralPath $f.FullName -Destination $destPath -Force
      $copied++

      # log + console
      "COPIED: $rel  ->  ProjectInspect\$destName" | Out-File -FilePath $outFile -Append -Encoding utf8
      Write-Host "COPIED: $rel -> ProjectInspect\$destName"
    } else {
      $skipped++

      "SKIP (same): $rel  ->  ProjectInspect\$destName" | Out-File -FilePath $outFile -Append -Encoding utf8
      Write-Host "SKIP (same): $rel -> ProjectInspect\$destName"
    }
  }
}

"" | Out-File -FilePath $outFile -Append -Encoding utf8
"Summary: copied=$copied, skipped=$skipped" | Out-File -FilePath $outFile -Append -Encoding utf8
Write-Host "Summary: copied=$copied, skipped=$skipped"

# ----------------------------
# DONE
# ----------------------------
Write-Section "DONE"
"Wrote: $outFile" | Out-File -FilePath $outFile -Append -Encoding utf8

Write-Host "Created/Updated: $outFile"
Write-Host "Attach/paste ProjectInspect\project-inspect.txt here (or at least trees + route handlers + flat copy section)."
