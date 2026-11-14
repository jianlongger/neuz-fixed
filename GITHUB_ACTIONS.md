# 用 GitHub Actions 在线编译（免装 Rust / VS，推荐）

> 前提：你有一台能访问 github.com 的设备（电脑/手机/平板均可），且有 GitHub 账号。
> 这条路线**不需要**在那台设备上装任何编译器，编译由 GitHub 的服务器代劳。

## 步骤
1. 在 github.com 上 **Fork** 原仓库 `MadrigalStreetCartel/neuz` 到你的账号
2. 把**本项目（已含修复）**推送到你的 fork：
   - **方式一（最简单）**：把本压缩包解压得到一个完整项目文件夹；然后
     `git clone` 你自己的 fork 到本地，把压缩包里的**所有文件**（除 `.git` 目录外）
     覆盖进 clone 出来的文件夹，再：
     ```
     git add -A
     git commit -m "fix: 容错数据目录路径 + 移除 Sentry 上报"
     git push
     ```
   - **方式二（最小改动）**：只把你压缩包里的这两个文件
     `src-tauri/src/main.rs` 和 `src-tauri/Cargo.toml` 替换进 fork 对应位置，
     并新增 `.github/workflows/build.yml`（本包已带），然后 push
3. 在你的 fork 页面点 **Actions** 标签 → 选 **Build Neuz (fixed)** →
   **Run workflow**（如果已配置 push 触发，push 后会自动开始）
4. 等待约 15–40 分钟；构建完成后在 **Artifacts** 区域下载 `neuz-msi`
   （里面是 `Neuz_*.msi`）
5. 把 `Neuz_*.msi` 传回你的**云电脑**安装，以管理员身份运行即可
   （profile 列表会显示 `DEFAULT`，点它高亮再点 `Play`）

## 说明
- `.github/workflows/build.yml` 已随本项目提供，会自动完成：
  装 Rust/Node → 删除残留 `Cargo.lock`（去掉 sentry 孤儿）→ `yarn install`
  → `yarn tauri build` → 上传 msi 产物
- 若你 fork 后默认分支不是 `main`/`master`，或只想手动触发，请用
  `workflow_dispatch`（Actions 页面右上角 Run workflow）
- 构建出的 msi **未做代码签名**，Windows 安装时可能弹出 SmartScreen 风险提示，
  选择"仍要运行 / 更多信息 → 仍要运行"即可，属正常现象

## 风险提醒（一直成立）
Neuz 是游戏 bot 工具，用官方账号运行**违反游戏服务条款、有封号风险**，
建议用小号。
