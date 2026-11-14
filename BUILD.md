# Neuz 修复版编译与运行说明（中文）

## 这个版本修了什么
原版 Neuz 在部分云桌面 / 受限环境下，后端读取数据目录的命令会因为有
`app_data_dir().unwrap()` 这样的写法，在取不到目录时直接崩溃，导致 profile
列表空白、永远进不了游戏（手动建目录也没用）。本修复版：

1. 新增 `resolve_app_data_dir()`：优先用 Tauri 的目录 API，取不到时回退到
   `LOCALAPPDATA\inc.madrigalstreetcartel.neuz`（正是你云电脑 `netease` 用户下
   `EBWebView` 缓存所在的位置），彻底消除崩溃。
2. 重写 `get_profiles`：读目录即使失败，也至少返回 `DEFAULT`，列表永不清空；
   建目录改用 `create_dir_all`，避免"已存在"报错。
3. 其余 7 处 `app_data_dir().unwrap()`（建窗口、读写配置等）一并换成容错解析，
   防止点 `Play` 之后在下一步又崩。
4. 已移除 Sentry 后台崩溃/错误上报代码（不再有任何遥测外联）。

> 程序对外网络只剩两处且都正常：前端拉 `updater.json` 检查更新、打开游戏官网
> `universe.flyff.com/play`。

## 你需要的编译环境（一台能正常上外网的 Windows 电脑）
> 你的云电脑装不了依赖，所以请在**另一台能联网的 Windows 10/11 电脑**上编译，
> 再把生成的 `.msi` 传回云电脑安装。

### 1. 安装 Rust 工具链
管理员 PowerShell 执行：
```
winget install Rustlang.Rustup
rustup install stable
```
首次会下载 Rust 工具链，需联网、几分钟。

### 2. 安装 Visual Studio 2022 生成工具（C++ 桌面开发）
- 下载并运行 **VS Build Tools 2022**
- 安装界面勾选 **使用 C++ 的桌面开发**（会自动包含 MSVC v143 + Windows 10/11 SDK）
- 或命令行：`winget install Microsoft.VisualStudio.2022.BuildTools`，然后在安装器里勾选上述工作负载

### 3. 安装 Node.js + yarn
```
winget install OpenJS.NodeJS.LTS
corepack enable
corepack prepare yarn@stable --activate
```
重启一次终端，确认 `node -v` / `yarn -v` 都能出版本号。

## 编译步骤
1. 把本项目文件夹解压到联网 Win 电脑（例如 `D:\neuz`）
2. 在项目根目录右键 **build.ps1 → 使用 PowerShell 运行**（建议管理员）
3. 脚本会：检测依赖 → 删除旧 `Cargo.lock`（去掉 sentry 残留）→ `yarn install` → `yarn tauri build`
4. 首次编译会下载并编译上百个 Rust crate，约 **15–40 分钟**，请保持联网、耐心等待
5. 完成后安装包位于：`src-tauri\target\release\bundle\msi\Neuz_*.msi`

## 回到云电脑安装运行
1. 把生成的 `Neuz_*.msi` 传到云电脑并安装
2. **以管理员身份**运行 Neuz
3. profile 列表应显示 `DEFAULT` → 先点它高亮 → 再点绿色 `Play`
4. 按提示选 playstyle、调设置、点 `ENGAGE`，Neuz 打开官方网页
   `universe.flyff.com/play`，在那里面用你的游戏账号登录（账号不经过 Neuz）

## 常见问题
- **编译报 sentry 相关错误**：确认 `src-tauri/Cargo.toml` 已无 sentry 依赖（本版已移除）；
  build.ps1 会自动删 `Cargo.lock` 重建。若仍报错，把完整输出发我。
- **MSVC 链接错误 / 找不到 cl.exe**：确认装了"使用 C++ 的桌面开发"工作负载（含 Windows SDK）。
- **yarn 不是内部或外部命令**：确认 `corepack enable` 已执行并重启终端。
- 其他任何报错，把完整信息发我，我帮你看。

## 风险提醒（一直成立）
Neuz 是游戏自动化/bot 工具，用官方账号运行**违反游戏服务条款、有封号风险**。
强烈建议用不重要的小号来跑。
