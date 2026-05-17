$ErrorActionPreference = "Stop"

function Get-CodexHome {
    if ($env:CODEX_HOME -and (Test-Path -LiteralPath $env:CODEX_HOME)) {
        return $env:CODEX_HOME
    }

    return (Join-Path $env:USERPROFILE ".codex")
}

function Get-TomlSectionValues {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$SectionName
    )

    $values = @{}
    $inSection = $false

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*\[([^\]]+)\]\s*$') {
            $inSection = ($matches[1] -eq $SectionName)
            continue
        }

        if (-not $inSection) {
            continue
        }

        if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*"([^"]*)"\s*$') {
            $values[$matches[1]] = $matches[2]
        }
    }

    return $values
}

function Resolve-NodeExe {
    $candidates = @()

    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles "nodejs\node.exe")
    }

    if (${env:ProgramFiles(x86)}) {
        $candidates += (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return (Get-Command node.exe -ErrorAction Stop).Source
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$configPath = Join-Path (Get-CodexHome) "config.toml"
$envValues = Get-TomlSectionValues -Path $configPath -SectionName "mcp_servers.youtube.env"

foreach ($entry in $envValues.GetEnumerator()) {
    [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value)
}

if (-not $env:YOUTUBE_API_KEY) {
    throw "YOUTUBE_API_KEY is missing from $configPath"
}

if (-not $env:APPDATA) {
    $env:APPDATA = Join-Path $env:USERPROFILE "AppData\Roaming"
}

$nodeExe = Resolve-NodeExe
$cliPath = Join-Path $projectDir "dist\cli.js"

Set-Location -LiteralPath $projectDir
& $nodeExe $cliPath
exit $LASTEXITCODE
