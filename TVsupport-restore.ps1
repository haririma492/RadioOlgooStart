# Restore-TVsupport.ps1
# Run from repo root

$Commit = "8726d5dae048d782aaaffc58bdda780fbf93301a"

$Files = @(
    "app/TVsupport/page.tsx",
    "components/TVsupport/TvSupportTabs.tsx",
    "components/TVsupport/LiveTab.tsx",
    "components/TVsupport/PlaylistTab.tsx",
    "components/TVsupport/ScheduleTab.tsx",
    "components/TVsupport/SubtitlesTab.tsx",
    "components/TVsupport/MediaPreview.tsx",
    "components/TVsupport/AdminBackfillTab.tsx",
    "components/TVsupport/shared.tsx"
)

Write-Host ""
Write-Host "Restoring TVsupport files from commit $Commit"
Write-Host ""

foreach ($File in $Files) {
    $Dir = Split-Path $File -Parent

    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    }

    $existsInCommit = git ls-tree -r --name-only $Commit -- $File

    if ($existsInCommit) {
        $content = git show "${Commit}:$File"
        [System.IO.File]::WriteAllLines(
            (Join-Path (Get-Location) $File),
            $content,
            [System.Text.UTF8Encoding]::new($false)
        )
        Write-Host "RESTORED: $File"
    }
    else {
        Write-Host "MISSING IN COMMIT: $File"
    }
}

Write-Host ""
Write-Host "Done. Review changes with:"
Write-Host "git status"
Write-Host "git diff -- app/TVsupport/page.tsx components/TVsupport"