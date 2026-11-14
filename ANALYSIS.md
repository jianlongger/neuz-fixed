# Neuz 代码分析报告

**仓库**：https://github.com/MadrigalStreetCartel/neuz
**分析对象**：`E:\script\claudeproject\feifei`（本地副本）
**分析日期**：2026-11-14

---

## 一、项目性质

**Neuz** 是 Flyff Universe（"飞飞"）网页客户端的**图像识别自动化外挂**，用 Tauri 桌面应用封装：Rust 后端 + React 前端。它不修改游戏内存、不注入游戏进程，而是：

1. 用 Tauri 开一个内嵌 webview 加载 `https://universe.flyff.com/play`（真正的游戏页面）；
2. 通过 `window.eval()` 往游戏页面注入 `eval.js`，伪造 `MouseEvent` / `KeyboardEvent` 派发到 canvas 上；
3. 用自研的 `libscreenshot`（fork 自 `MadrigalStreetCartel/libscreenshot`）截取窗口像素，在 Rust 侧做颜色识别，判断"血条还有多少血""怪物名字在哪个位置"。

### 版本与来源核对

| 项 | 值 |
|---|---|
| 本地副本对应上游 commit | `564b28a`（2026-08-09，"Merge pull request #94 ... fix-farming-stats-view"） |
| 与上游 `main` 的差异 | **逐字节一致**，仅 CRLF vs LF 行尾差异 |
| 最新发布 tag | `Neuz-v0.16.4`（`1e6f033`） |
| `main` 领先 tag 的改动 | 4 个文件：`farming_behavior.rs`、`main.rs`、`MissionControl.tsx`、`FarmingConfig.tsx` |
| 真实版本号 | `src-tauri/tauri.conf.json` = `0.16.4`（`package.json` 里的 `0.1.0` 是 CRA 模板残留） |
| 许可证 | MPL-2.0 |
| 总提交数 | 161 |

> 结论：**本地这份不是被改过的 fork，就是上游 main 原样**。下面所有问题在上游同样存在。

---

## 二、架构

```
src/                    React 18 + Recoil + styled-components (CRA 5)
  Launcher.tsx          启动器：profile 管理 → Play
  MissionControl.tsx    运行时控制台：三种模式 Tab + 实时统计
  models/BotConfig.tsx  9×10 槽位（技能栏）模型
src-tauri/src/
  main.rs               主循环 + Tauri commands + profile 文件管理
  image_analyzer.rs     像素识别（核心）
  behavior/             三种行为：Farming / Support / AutoShout
  movement/             动作 DSL（play! 宏 + Movement 枚举）
  platform/eval.js      注入游戏的 JS（伪造输入）
  ipc/bot_config.rs     配置序列化（.botconfig_<profile> JSON）
```

### 主循环（`src-tauri/src/main.rs:380-570`）

单线程 `loop`，每帧：

1. `capture_window()` 截屏 → `ClientStats::update()` 读血条 / 目标标记
2. 分派到当前 `Behavior::run_iteration()`
3. 通过 Tauri event `bot_config_s2c` / `bot_info_s2c` 推给前端

配置双向同步靠 `bot_config_c2s` 事件 + `change_id` 计数器（`ipc/bot_config.rs:494-497`）。

### 图像识别（`src-tauri/src/image_analyzer.rs`）

- **血条**：在固定矩形区域（`data/stats_info.rs:263-325`）内按 RGB 参考色匹配（HP 红、MP 蓝、FP 绿），取匹配像素的**宽度**比例算百分比。
- **怪物名**：全屏扫描三种参考色（被动 `234,234,149` / 主动 `179,23,23` / 紫 `182,144,146`），`cluster_by_distance` 先按 X 轴（距离 50）再按 Y 轴（距离 3）聚类成"怪物名字框"，再按名字宽度过滤（11~180px）。
- **目标标记**：找红色 `(246,90,106)` 箭头，找不到退而找蓝色 `(131,148,205)`。

### 三种行为

| 模式 | 状态机 / 职责 |
|---|---|
| **Farming** | `NoEnemyFound → SearchingForEnemy → EnemyFound → VerifyTarget → Attacking → AfterEnemyKill` |
| **Support** | 跟随目标 + 治疗 / 复活 / 增益 / 组队技能 |
| **AutoShout** | 定时循环发聊天消息 |

### 动作 DSL（`movement.rs` + `movement/movement_coordinator.rs`）

```rust
play!(self.movement => [
    HoldKeys(vec!["W", "Space", "D"]),
    Wait(dur::Fixed(rotation_duration)),
    ReleaseKey("D"),
]);
```

`MovementAccessor` 用 `Mutex` 串行化动作，`MovementCoordinator` 把每个动作翻译成 `eval_send_key` / `send_slot_eval` 的 JS 注入。

---

## 三、发现的问题

### 🔴 1. `setInputChat` 未转义 → AutoShout 消息直接抛 JS 异常

**位置**：`src-tauri/src/platform/shared.rs:74`

```rust
pub fn eval_send_message(window: &Window, text: &str) {
    drop(window.eval(format!("setInputChat({0})", text).as_str()));
}
```

消息被**裸插**进 JS 表达式，既没有引号也没有转义。实测验证（Node 复现）：

| 输入 | 生成的 JS | 结果 |
|---|---|---|
| `hello world` | `setInputChat(hello world)` | `SyntaxError: missing ) after argument list` |
| `hello` | `setInputChat(hello)` | `ReferenceError: hello is not defined` |
| `buy me a pen` | `setInputChat(buy me a pen)` | `SyntaxError` |

**所有含空格或非标识符的消息都会静默失败** —— `drop()` 把 `Result` 吞掉了，界面上看不到任何报错，只是消息没发出去。

上游 `main` 和 `dev` 分支**都是这样**。v0.16.3 及之前用的是：

```js
document.querySelector('input').value = '{0}';
```

（带引号，能用）。v0.16.4 重写 eval API 时改成了无引号形式 —— **这是 v0.16.4 引入的回归**（引入 commit：`1e6f033` "Feat/v0.16.4"）。

**建议修法**：

```rust
pub fn eval_send_message(window: &Window, text: &str) {
    let encoded = serde_json::to_string(text).unwrap_or_else(|_| "\"\"".into());
    drop(window.eval(format!("setInputChat({})", encoded).as_str()));
}
```

用 JSON 编码同时解决转义和引号问题。

---

### 🔴 2. `rename_profile` 复制粘贴 bug —— 配置文件从不重命名

**位置**：`src-tauri/src/main.rs:233-251`

```rust
drop(fs::rename(
    config_folder_path(&app_handle, &profile_id),
    config_folder_path(&app_handle, &new_profile_id),
));
drop(fs::rename(
    config_folder_path(&app_handle, &profile_id),
    config_folder_path(&app_handle, &new_profile_id).clone(),
));
```

两次 `fs::rename` **参数完全相同**。第二次必然失败（源路径已不存在），错误又被 `drop()` 吞掉。

更关键的是：**从头到尾没有碰 `config_file_path`**（`.botconfig_<profile>`，存机器人配置的 JSON）。

结果：重命名 profile 后 ——

- 角色浏览器数据目录 `profile_<old>/` → `profile_<new>/` ✅
- 机器人配置 `.botconfig_<old>` **仍留在旧名字下** ❌

于是新 profile 读不到配置，走 `deserialize_or_default` 拿默认值，用户的技能栏 / 颜色阈值 / 各项开关全部丢失。

对比同文件中写法正确的 `copy_profile`（`main.rs:193-211`）：

```rust
drop(fs::copy(
    config_file_path(&app_handle, &profile_id),
    config_file_path(&app_handle, &new_profile_id).clone(),
));
drop(copy_dir_all(
    config_folder_path(&app_handle, &profile_id),
    config_folder_path(&app_handle, &new_profile_id),
));
```

**建议修法**：把第二次 rename 的源/目标改成 `config_file_path`：

```rust
drop(fs::rename(
    config_file_path(&app_handle, &profile_id),
    config_file_path(&app_handle, &new_profile_id),
));
```

（并给 `fs::rename` 的 Result 加日志，别用 `drop()` 吞掉。）

---

### 🟠 3. `identify_mobs` 有死锁风险

**位置**：`src-tauri/src/image_analyzer.rs:218-259`

```rust
let (snd, recv) = sync_channel::<MobPixel>(4096);
image.enumerate_rows().par_bridge().for_each(move |(y, row)| {
    ...
    drop(snd.send(MobPixel(x, y, TargetType::Mob(MobType::Passive))));   // 阻塞发送
});
while let Ok(px) = recv.recv() {   // ← 消费者在 for_each 结束后才开始
```

生产者用**阻塞**的 `snd.send()` 写入容量 4096 的有界 channel，而消费者循环在 `for_each` **之后**才开始执行。

当一帧内匹配到的怪物名像素超过 4096 个时（怪物密集区很容易达到 —— 每个怪物名几十到上百像素），生产者永久阻塞等待容量释放，但没人来收 → **主循环彻底卡死**。

对照：同文件 `pixel_detection`（`image_analyzer.rs:118`）用的是非阻塞版本：

```rust
drop(snd.try_send(Point::new(x, y)).map_err(|err| {
    eprintln!("Error sending data: {}", err);
}));
```

说明作者已经意识到这个模式并在一处修了，但 `identify_mobs` 没同步修。git 历史佐证：`1e6f033` 里 `pixel_detection` 从 `snd.send` 改成了 `snd.try_send`，`identify_mobs` 保持原样。

**建议修法**：`identify_mobs` 同样改用 `try_send`，与 `pixel_detection` 保持一致。

---

### 🟠 4. `pixel_detection` 的 `max_x` / `max_y` 语义混乱

**位置**：`src-tauri/src/image_analyzer.rs:89-101`

```rust
if y <= IGNORE_AREA_TOP
    || y > image_height.checked_sub(IGNORE_AREA_BOTTOM).unwrap_or(image_height)
    || y > IGNORE_AREA_TOP + max_y   // 相对：max_y 当作相对偏移
    || y > max_y                      // 绝对：max_y 又当作绝对坐标
    || y < min_y
```

同一个 `max_y` 在两处含义不同（一个加 `IGNORE_AREA_TOP` 当相对偏移，一个直接当绝对像素）。

而 `StatusBarConfig`（`data/stats_info.rs:263-325`）里 `max_y` 明确是绝对坐标（TargetHP: `min_y=30, max_y=60`）。

目前 HP/MP/FP 用默认值（`min_y=30, max_y=110`）勉强能工作，但这是隐藏的语义冲突 —— 改任何一个数值都可能悄悄改变行为。

---

### 🟡 5. 一批"前端有 UI、后端从不读取"的死配置

| 配置项 | 前端 UI | Rust 后端 |
|---|---|---|
| `on_afk_disconnect` / `afk_timeout` | 有（`SupportConfig.tsx:98` 有齿轮按钮；`FarmingConfig.tsx:235` 的 modal **从未 `open`**，无入口） | **从未读取**。`set_afk_ready_to_disconnect` 从未被调用，`main.rs:495` 的 `app_handle.exit(0)` 永远不触发 |
| `interval_between_buffs` | 有（`FarmingConfig.tsx:105`、`SupportConfig.tsx:70`） | `interval_between_buffs()` **无任何调用点** |
| `prevent_already_attacked` | 有（`FarmingConfig.tsx:142`） | `farming_behavior.rs:585-597` 整段被注释掉。changelog 承认"Removes (temporary?) prevent already attacked feature" |
| `violet_mobs_colors` / `violet_tolerence` | **无 UI** | Rust 读取了，但结果 `_mobs_violet` 被丢弃（`image_analyzer.rs:272`），紫怪永远不会被打 |
| `farming_enabled` | 无 | Rust 有字段，无读取点 |

**AFK 检测链路是完整断裂的**：前端有配置项 → Rust 有字段 → 但没有任何代码把 `true` 写进 `FrontendInfo::afk_ready_to_disconnect` → 主循环的退出分支永远不执行。

---

### 🟡 6. 三个 profile 命令对两类路径的处理不一致

| 命令 | `config_folder_path`（`profile_<id>/`，角色数据） | `config_file_path`（`.botconfig_<id>`，机器人配置） |
|---|---|---|
| `copy_profile` | ✅ `copy_dir_all` | ✅ `fs::copy` |
| `remove_profile` | ✅ `remove_dir_all` | ✅ `remove_file` |
| `rename_profile` | ⚠️ rename 了两次（第二次必失败） | ❌ **完全没处理** |

---

### 🟡 7. `movement_coordinator.rs` 中 3 个枚举变体从未被使用

`Movement::Jump`、`Movement::Move`、`Movement::Repeat` —— grep 确认业务代码零引用（只有 `Type`、`HoldKey*`、`Wait`、`PressKey`、`ReleaseKey*`、`Rotate` 在用）。`Move` / `Repeat` 已被 `HoldKeyFor` / `play!` 取代，`Jump` 被 `HoldKeys(["W","Space"])` 取代。

---

### 🟡 8. `data/pixel_detection.rs` 整个文件是死代码

`PixelDetection` 结构和 `CursorType` 枚举的实现在注释块里（98-140 行），`PixelDetectionConfig` 无人引用。`data.rs:17` 仍在 `mod pixel_detection;` 引入。

---

### 🟡 9. `identify_target_marker` 重复全屏扫描

**位置**：`src-tauri/src/image_analyzer.rs:282-338`

`stats_info.rs:100-105` 已经先试蓝色、再试红色：

```rust
let blue_target = image.identify_target_marker(true);
let target = if blue_target.is_some() { blue_target } else { image.identify_target_marker(false) };
```

而 `identify_target_marker(false)` 内部（`:332-334`）在红色找不到时**又递归调回蓝色**：

```rust
if !blue_target && target_markers.is_empty() {
    return self.identify_target_marker(true);
}
```

蓝色找不到时，同一帧要跑 **3 次**全屏像素扫描（每次约 1MB 级遍历），而实际只需要 2 次。

---

### 🔵 10. 其他工程观察

- **`libscreenshot` 是 git 依赖**（`Cargo.toml:38`），指向 `MadrigalStreetCartel/libscreenshot`，Cargo.lock 锁到 commit `61e1b28`。构建时该仓库必须可达。
- **Sentry DSN 硬编码**在 `main.rs:47-50`，运行时把日志上报到上游作者的 Sentry 项目（`o1322474.ingest.sentry.io/6579555`）。自行编译分发 = 替上游上报使用数据。介意的话删掉这段即可。
- **Tauri CSP 非常宽松**（`tauri.conf.json:51`）：`default-src ... http: https: 'unsafe-eval' 'unsafe-inline'`，且 `allowlist: {"all": true}`。客户端窗口加载的是**外部 URL**，但 `tauri.conf.json` 里**没有**配置 `dangerousRemoteDomainIpcAccess` —— 所以远程页面拿不到 Tauri IPC。这一点是**正确的**，值得肯定。
- **`releases/` 目录 234MB 的 MSI 安装包被提交进了 git**（19 个文件，占仓库 245MB 的 **95%**）。这是 `git clone` 经常超时/失败的原因（本次克隆即因此失败）。CI 完全不需要它们。
- **本机无 Rust 工具链**（`cargo` / `rustc` 均未安装），因此**未能编译验证**；Node 有 v24.15 但无 `yarn`（可用 npm）。构建需要：Rust stable + yarn + WebView2 + Tauri 系统依赖。
- **CI 流水线**（`.github/workflows/`）三个 workflow 都在 `tauri-apps/tauri-action@v0` 上跑三平台矩阵（macos / ubuntu / windows）。

---

## 四、建议修复优先级

| 优先级 | 项 | 位置 | 性质 |
|---|---|---|---|
| 1 | `setInputChat` 加 JSON 编码 | `platform/shared.rs:74` | 一行修复，恢复 AutoShout（v0.16.4 回归） |
| 2 | `rename_profile` 第二次 rename 改用 `config_file_path` | `main.rs:243-251` | 一行修复，避免用户配置丢失 |
| 3 | `identify_mobs` 改 `try_send` | `image_analyzer.rs:236-248` | 与 `pixel_detection` 对齐，消除死锁 |
| 4 | `releases/*.msi` 移出 git（改用 GitHub Releases 附件） | 仓库层 | 仓库从 245MB → ~12MB，clone 不再超时 |
| 5 | 补齐或删除 AFK / `interval_between_buffs` 等死配置 | 多处 | 消除 UI 误导 |
| 6 | 统一 `pixel_detection` 的 `max_x`/`max_y` 语义 | `image_analyzer.rs:89-101` | 消除隐藏耦合 |
| 7 | `identify_target_marker` 去掉冗余递归 | `image_analyzer.rs:332` | 每帧省一次全屏扫描 |

---

## 五、复现方式

### 验证 `setInputChat` 缺陷

```bash
cat > t.js <<'EOF'
function setInputChat(text){ return text; }
for (const c of ["hello world", "hello"]) {
  const js = `setInputChat(${c})`;
  try { console.log(JSON.stringify(c), "=> OK:", setInputChat(eval(js))); }
  catch(e){ console.log(JSON.stringify(c), "=> THROWS:", e.constructor.name, e.message); }
}
EOF
node t.js
```

### 验证与上游一致性

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/MadrigalStreetCartel/neuz upstream
cd upstream && git sparse-checkout init --cone && git sparse-checkout set src src-tauri/src
git checkout main
# 忽略行尾差异逐文件比对
for f in $(cd src-tauri/src && find . -name "*.rs" -o -name "*.js" | sort); do
  diff -q --strip-trailing-cr "src-tauri/src/$f" "/path/to/local/src-tauri/src/$f" || echo "DIFF: $f"
done
```

结果：无差异 —— 本地副本即上游 main。

---

*报告由 Claude Code 生成于 2026-11-14*
