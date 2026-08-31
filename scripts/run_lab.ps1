param(
    [switch]$Reset,
    [switch]$Quick,
    [switch]$Serve
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Push-Location $projectRoot
try {
    uv sync --frozen
    $labArguments = @("run", "digit-lm", "run-lab")
    if ($Reset) { $labArguments += "--reset" }
    if ($Quick) { $labArguments += "--quick" }
    & uv @labArguments
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if ($Serve) {
        & uv run digit-lm serve
    }
}
finally {
    Pop-Location
}
