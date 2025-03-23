#!/usr/bin/env pwsh
# Cleanup script for removing temporary build files in the project

Write-Host "Starting cleanup of temporary build files..." -ForegroundColor Green

# Remove node_modules directories
Write-Host "Removing node_modules directories..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Directory -Path . -Include "node_modules" | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
}

# Remove dist directories
Write-Host "Removing dist directories..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Directory -Path . -Include "dist" | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
}

# Remove .turbo directories
Write-Host "Removing .turbo directories..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Directory -Path . -Include ".turbo" | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
}

# Remove .tsbuildinfo files
Write-Host "Removing .tsbuildinfo files..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Path . -Include "*.tsbuildinfo" | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
}

# Remove .env files (excluding .env.example)
Write-Host "Removing .env files (excluding .env.example)..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Path . -Include "*.env" -Exclude "*.env.example" | Where-Object { $_.Name -ne ".env.example" } | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
}

# Remove .tar and related archive files
Write-Host "Removing .tar and related archive files..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Path . -Include "*.tar", "*.tar.gz", "*.tgz", "*.tar.bz2", "*.tbz2", "*.tar.xz", "*.txz" | ForEach-Object {
    Write-Host "  Removing $($_.FullName)" -ForegroundColor Gray
    Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
}

Write-Host "Cleanup completed successfully!" -ForegroundColor Green
Write-Host "Note: Project source files have been preserved." -ForegroundColor Cyan 