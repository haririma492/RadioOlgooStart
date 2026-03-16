# Restore-TVsupport-Api.ps1
$Commit = "8726d5dae048d782aaaffc58bdda780fbf93301a"

$Files = @(
    "app/api/olgoo-live/content/route.ts",
    "app/api/olgoo-live/playlists/route.ts",
    "app/api/olgoo-live/schedules/route.ts",
    "app/api/olgoo-live/state/route.ts",
    "app/api/olgoo-live/control/route.ts"
)

foreach ($File in $Files) {
    $existsInCommit = git ls-tree -r --name-only $Commit -- $File
    if ($existsInCommit) {
        $Dir = Split-Path $File -Parent
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null

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