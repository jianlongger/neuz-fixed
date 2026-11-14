<#
  Neuz 修复版 一键编译脚本 (Windows)
  本脚本只负责"编译"，前置依赖需先装好：
    - Rust (stable)        命令: cargo / rustc 可用
    - VS2022 生成工具       含"使用 C++ 的桌面开发"工作负载 (MSVC v143 + Windows SDK)
    - Node.js + yarn       命令: node / yarn 可用 (corepack enable)
  用法：在项目根目录右键 build.ps1 -> 使用 PowerShell 运行（建议以管理员身份）
#>
$ErrorActionPreference = "Stop"

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction SilentlyContinue | Out-Null; return $true }
    catch { return $false }
}

Write-Host "=== 检测编译依赖 ===" -ForegroundColor Cyan

if (-not (Test-Command cargo)) {
    Write-Host "x 未找到 Rust(cargo)。请先执行: winget install Rustlang.Rustup ; rustup install stable" -ForegroundColor Red
    exit 1
}
Write-Host "[ok] Rust / cargo" -ForegroundColor Green

if (-not (Test-Command yarn)) {
    Write-Host "x 未找到 yarn。请先执行: corepack enable ; corepack prepare yarn@stable --activate" -ForegroundColor Red
    exit 1
}
Write-Host "[ok] yarn" -ForegroundColor Green

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVc = $false
if (Test-Path $vswhere) {
    $out = & $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -latest -property isComplete 2>$null
    if ($out -contains "true") { $hasVc = $true }
}
if (-not $hasVc) {
    Write-Host "x 未检测到 VS2022 C++ 桌面开发工作负载(MSVC)。请安装 VS Build Tools 2022 并勾选'使用 C++ 的桌面开发'。" -ForegroundColor Red
    exit 1
}
Write-Host "[ok] VS2022 C++ 工具链" -ForegroundColor Green

Write-Host "=== 清理旧 Cargo.lock (移除 sentry 孤儿依赖) ===" -ForegroundColor Cyan
if (Test-Path "src-tauri/Cargo.lock") { Remove-Item "src-tauri/Cargo.lock" -Force }

Write-Host "=== yarn install ===" -ForegroundColor Cyan
yarn install

Write-Host "=== yarn tauri build (首次编译约 15-40 分钟，请保持联网) ===" -ForegroundColor Cyan
yarn tauri build

Write-Host "=== 完成! 安装包位于: src-tauri\target\release\bundle\msi\ ===" -ForegroundColor Green
