# Find-TVsupportPage.ps1
# Run from repo root

$TargetPath = "app/TVsupport/page.tsx"

git fetch origin | Out-Null

$branches = git for-each-ref --format="%(refname:short)" refs/remotes/origin |
    Where-Object { $_ -notmatch 'HEAD$' }

Write-Host "`nSearching exact path: $TargetPath`n"

$exactMatches = @()

foreach ($branch in $branches) {
    $found = git ls-tree -r --name-only $branch -- "$TargetPath" 2>$null
    if ($found) {
        $exactMatches += [PSCustomObject]@{
            Branch = $branch
            Path   = $found
        }
    }
}

if ($exactMatches.Count -gt 0) {
    Write-Host "Exact matches found:`n"
    $exactMatches | Format-List
} else {
    Write-Host "No exact match found for $TargetPath on any origin branch.`n"
}

Write-Host "`nSearching similar TVsupport paths (case-insensitive)...`n"

$similarMatches = @()

foreach ($branch in $branches) {
    $files = git ls-tree -r --name-only $branch 2>$null
    $hits = $files | Where-Object {
        $_ -match '(?i)app/.+page\.tsx$' -and $_ -match '(?i)tvsupport'
    }

    foreach ($hit in $hits) {
        $similarMatches += [PSCustomObject]@{
            Branch = $branch
            Path   = $hit
        }
    }
}

if ($similarMatches.Count -gt 0) {
    Write-Host "Similar matches found:`n"
    $similarMatches | Sort-Object Branch, Path | Format-List
} else {
    Write-Host "No similar TVsupport page.tsx paths found on any origin branch."
}