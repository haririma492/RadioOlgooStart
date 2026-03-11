$ErrorActionPreference = "Stop"

$Region = "ca-central-1"
$Tables = @("RadioOlgooSlides", "RadioOlgooContent")
$OutDir = Join-Path (Get-Location) "ddb-inspect-output"

if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# Safer UTF-8 settings for this session
$env:PYTHONIOENCODING = "utf-8"
$env:AWS_CLI_FILE_ENCODING = "utf-8"
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

Require-Command "aws"
Require-Command "python"

function Invoke-AwsJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$AwsArgs,

        [Parameter(Mandatory = $true)]
        [string]$OutFile
    )

    $tmpRaw = [System.IO.Path]::GetTempFileName()
    $tmpEscaped = [System.IO.Path]::GetTempFileName()

    try {
        # Run AWS CLI and capture raw stdout/stderr separately
        $stderrFile = [System.IO.Path]::GetTempFileName()
        & aws @AwsArgs 1> $tmpRaw 2> $stderrFile

        if ($LASTEXITCODE -ne 0) {
            $err = Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue
            throw "AWS CLI failed for: aws $($AwsArgs -join ' ')`n$err"
        }

        # Re-emit JSON with ensure_ascii=True so Windows console/file encoding won't choke
        & python -c "import sys,json; print(json.dumps(json.load(open(sys.argv[1], 'r', encoding='utf-8')), ensure_ascii=True, indent=2))" $tmpRaw 1> $tmpEscaped

        if ($LASTEXITCODE -ne 0) {
            throw "Python failed while normalizing JSON output."
        }

        Copy-Item $tmpEscaped $OutFile -Force
        return Get-Content $OutFile -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    finally {
        foreach ($f in @($tmpRaw, $tmpEscaped, $stderrFile)) {
            if ($f -and (Test-Path $f)) {
                Remove-Item $f -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Convert-DdbItemToSimpleObject {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Item
    )

    $obj = [ordered]@{}

    foreach ($prop in $Item.PSObject.Properties) {
        $name = $prop.Name
        $val = $prop.Value

        if ($null -eq $val) { $obj[$name] = $null; continue }
        if ($null -ne $val.S)    { $obj[$name] = $val.S; continue }
        if ($null -ne $val.N)    { $obj[$name] = $val.N; continue }
        if ($null -ne $val.BOOL) { $obj[$name] = $val.BOOL; continue }
        if ($null -ne $val.NULL) { $obj[$name] = $null; continue }
        if ($null -ne $val.SS)   { $obj[$name] = ($val.SS -join ", "); continue }
        if ($null -ne $val.NS)   { $obj[$name] = ($val.NS -join ", "); continue }
        if ($null -ne $val.L)    { $obj[$name] = "[List]"; continue }
        if ($null -ne $val.M)    { $obj[$name] = "[Map]"; continue }

        $obj[$name] = ($val | ConvertTo-Json -Compress -Depth 20)
    }

    [pscustomobject]$obj
}

foreach ($Table in $Tables) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "TABLE: $Table" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    $descPath = Join-Path $OutDir "$Table-desc.json"
    $scanPath = Join-Path $OutDir "$Table-scan.json"
    $sampleTxtPath = Join-Path $OutDir "$Table-sample.txt"
    $attrsTxtPath = Join-Path $OutDir "$Table-attributes.txt"

    Write-Host "[1] Describe table..." -ForegroundColor Yellow
    $desc = Invoke-AwsJson -AwsArgs @(
        "dynamodb", "describe-table",
        "--region", $Region,
        "--table-name", $Table,
        "--output", "json",
        "--no-cli-pager"
    ) -OutFile $descPath

    $t = $desc.Table

    Write-Host "TableName     : $($t.TableName)"
    Write-Host "TableStatus   : $($t.TableStatus)"
    Write-Host "ItemCount     : $($t.ItemCount)"
    Write-Host "TableSizeBytes: $($t.TableSizeBytes)"
    Write-Host "BillingMode   : $($t.BillingModeSummary.BillingMode)"
    Write-Host "CreationDate  : $($t.CreationDateTime)"

    Write-Host "`nKeySchema:" -ForegroundColor Green
    if ($t.KeySchema) { $t.KeySchema | Format-Table -AutoSize } else { Write-Host "None" }

    Write-Host "`nAttributeDefinitions:" -ForegroundColor Green
    if ($t.AttributeDefinitions) { $t.AttributeDefinitions | Format-Table -AutoSize } else { Write-Host "None" }

    if ($t.GlobalSecondaryIndexes) {
        Write-Host "`nGlobalSecondaryIndexes:" -ForegroundColor Green
        foreach ($gsi in $t.GlobalSecondaryIndexes) {
            Write-Host "  GSI Name: $($gsi.IndexName)" -ForegroundColor Magenta
            $gsi.KeySchema | Format-Table -AutoSize
            Write-Host "  ProjectionType: $($gsi.Projection.ProjectionType)"
        }
    }
    else {
        Write-Host "`nGlobalSecondaryIndexes: none"
    }

    Write-Host "`n[2] Scan sample items..." -ForegroundColor Yellow
    $scan = Invoke-AwsJson -AwsArgs @(
        "dynamodb", "scan",
        "--region", $Region,
        "--table-name", $Table,
        "--limit", "10",
        "--output", "json",
        "--no-cli-pager"
    ) -OutFile $scanPath

    Write-Host "Returned sample count: $($scan.Count)"
    Write-Host "Scanned count        : $($scan.ScannedCount)"
    Write-Host "Has more pages       : $([bool]$scan.LastEvaluatedKey)"

    $simpleItems = @()
    foreach ($item in $scan.Items) {
        $simpleItems += Convert-DdbItemToSimpleObject -Item $item
    }

    if ($simpleItems.Count -gt 0) {
        $simpleItems | Format-List | Out-File -FilePath $sampleTxtPath -Encoding utf8

        $attrs = $simpleItems |
            ForEach-Object { $_.PSObject.Properties.Name } |
            Sort-Object -Unique

        $attrs | Out-File -FilePath $attrsTxtPath -Encoding utf8

        Write-Host "`nSample rows saved to: $sampleTxtPath" -ForegroundColor Green
        Write-Host "Attribute list saved to: $attrsTxtPath" -ForegroundColor Green
        Write-Host "Raw describe JSON saved to: $descPath" -ForegroundColor Green
        Write-Host "Raw scan JSON saved to: $scanPath" -ForegroundColor Green
    }
    else {
        Write-Host "No items found."
    }
}

Write-Host ""
Write-Host "Done. Output folder: $OutDir" -ForegroundColor Cyan