param(
    [string]$Description = "Multi-Agent Terminal for TDT Vibe Coding - Run multiple AI coding agents in parallel terminal panes",
    [string]$Website = "https://github.com/TheDemonTuan/all-agent-in-one"
)

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "=== TDT Space - Repository Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Check auth
Write-Host "Checking authentication..." -ForegroundColor Yellow
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated! Run: gh auth login" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Authenticated" -ForegroundColor Green
Write-Host ""

# Set description
Write-Host "Setting repository description..." -ForegroundColor Yellow
gh repo edit --description $Description
Write-Host "✓ Description set" -ForegroundColor Green
Write-Host ""

# Set website
Write-Host "Setting website..." -ForegroundColor Yellow
gh repo edit --homepage $Website
Write-Host "✓ Website set" -ForegroundColor Green
Write-Host ""

# Add topics
$topics = @(
    "electron",
    "terminal",
    "ai",
    "react",
    "typescript",
    "electron-app",
    "productivity",
    "developer-tools",
    "windows",
    "multi-agent",
    "vite",
    "xterm",
    "workspace",
    "coding",
    "automation"
)

Write-Host "Adding topics..." -ForegroundColor Yellow
foreach ($topic in $topics) {
    Write-Host "  Adding: $topic" -ForegroundColor Cyan
    gh repo edit --add-topic $topic
}
Write-Host "✓ Topics added ($($topics.Count) total)" -ForegroundColor Green
Write-Host ""

# Set default branch
Write-Host "Setting default branch to main..." -ForegroundColor Yellow
gh repo edit --default-branch main
Write-Host "✓ Default branch set" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "=== Configuration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: https://github.com/TheDemonTuan/all-agent-in-one" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Upload social preview image (1280x640px)" -ForegroundColor White
Write-Host "  2. Set up branch protection rules" -ForegroundColor White
Write-Host "  3. Enable Dependabot alerts" -ForegroundColor White
Write-Host "  4. Configure GitHub Sponsors" -ForegroundColor White
Write-Host ""
