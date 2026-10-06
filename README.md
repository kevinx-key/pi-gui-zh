# pi-gui 简体中文版

> [pi-gui](https://github.com/minghinmatthewlam/pi-gui) 的简体中文汉化分支，桌面端界面全中文，开箱即用。

> [!WARNING]
> **非官方汉化版**：本项目是社区个人维护的第三方汉化分支，**与上游 pi-gui 作者、pi（Earendil Works）官方无任何隶属、赞助或背书关系**，请勿将其视为官方产物。上游版权归原作者所有，详见 [NOTICE](./NOTICE)。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-x64-0078D4)](https://github.com/kevinx-key/pi-gui-zh/releases/latest)
[![Upstream](https://img.shields.io/badge/upstream-minghinmatthewlam%2Fpi--gui-lightgrey)](https://github.com/minghinmatthewlam/pi-gui)

pi-gui 是 [pi coding agent](https://github.com/earendil-works/pi) 的桌面外壳：把原本跑在终端里的模型选择、对话、工具调用、会话文件和代码操作，组织成可视化窗口。它**不另造一套 Agent**——模型、登录、工具全部走 pi 本身，任何你在 pi CLI 里配置过的东西都会带过来。

本仓库在其基础上做了**源码级全量简体中文汉化**（界面 + Electron 原生层），默认中文，并保留中英切换。

![pi-gui 界面](https://raw.githubusercontent.com/minghinmatthewlam/pi-gui/main/apps/website/public/media/hero.gif)

---

## 功能特性

- **并行线程**：每个任务一条线程，可跑在项目目录或独立 git 工作树里；侧边栏显示运行 / 完成 / 需要你处理的状态
- **改动审查**：Review 标签页展示 Agent 改了什么，可对比未提交改动、分支差异或单轮改动，逐文件暂存 / 取消暂存
- **终端与文件同窗**：集成真实终端、文件树与编辑器、工作树、Diff 面板
- **多模型 / 多提供商**：OAuth 登录、API Key 或自定义端点；每条线程可选模型与思考等级
- **分叉与回退**：从任意消息分叉到同一目录或新工作树，用 `/tree` 在会话树中移动
- **技能与扩展**：开关 pi 的技能 / 扩展，为其提供独立的工作台标签页
- **定时任务**：让 pi 按计划重跑提示词（如每周依赖检查）
- **多 Agent 编排**：主会话可创建、监督子会话，子线程在侧栏可见
- **中文界面**：主界面、设置、对话框、原生菜单与系统通知均为简体中文，可切换英文

## 下载与安装

到 [Releases](https://github.com/kevinx-key/pi-gui-zh/releases/latest) 下载（仅 Windows x64）：

| 文件                             | 说明                         |
| -------------------------------- | ---------------------------- |
| `pi-gui-<版本>-x64-setup.exe`    | **安装版**，推荐             |
| `pi-gui-<版本>-x64-portable.exe` | **便携版**，免安装，双击即用 |

> ⚠️ 安装包**未做代码签名**，Windows SmartScreen 可能提示"Windows 已保护你的电脑"。点击 **更多信息 → 仍要运行** 即可。

### 运行要求

- Windows 10 / 11（x64）
- 一个模型提供商的凭据（OAuth 登录或 API Key，例如 DeepSeek、OpenAI、Anthropic、OpenRouter 等）

## 首次使用

1. 打开 pi-gui。
2. **设置 → 提供商**：登录或填入 API Key（例如 DeepSeek 需要 `DEEPSEEK_API_KEY`，也可直接作为环境变量提供）。
3. **添加工作区**：选择一个本地代码项目文件夹。
4. **新建线程**：选择 `本地` 或 `工作树`，然后发送第一条消息。

### 切换语言

**设置 → 外观 → 界面语言** 可在「简体中文 / English」之间切换，选择会被记住，重启后保持。

## 中文汉化说明

- **实现方式**：源码级 i18n，自建轻量 `t()`。核心位于 [`apps/desktop/contracts/i18n`](./apps/desktop/contracts/i18n)（纯 TS，主进程与渲染层共用），渲染层绑定在 [`apps/desktop/src/i18n`](./apps/desktop/src/i18n)。
- **词典**：英文原文即 key，中文词典单表维护于 [`contracts/i18n/locales/zh-CN.ts`](./apps/desktop/contracts/i18n/locales/zh-CN.ts)；缺失条目自动回退英文，不会出现空白。
- **默认语言**：简体中文。
- **术语表**：线程 / 会话 / 提供商 / 模型 / 工作树 / 工作区 / 扩展 / 技能 / 输入框 / 审查 / 差异 / 终端 / 命令面板 / 定时任务。

## 自行构建

需要 **Node.js ≥ 22.19** 与 **pnpm**（仓库通过 `packageManager` 锁定 `pnpm@10.25.0`，建议用 `corepack`）：

```bash
corepack enable
pnpm install
```

常用命令（仓库根）：

```bash
pnpm dev                                  # 开发模式，热重载
pnpm --filter @pi-gui/desktop run build           # 仅构建
pnpm --filter @pi-gui/desktop run package:win      # 生成 Windows 安装版 + 便携版
pnpm --filter @pi-gui/desktop run package:win:dir  # 只生成未打包目录 win-unpacked
```

国内网络建议加镜像加速 Electron 下载：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
```

产物位于 `apps/desktop/release/`。

## 与上游的关系

本仓库是 [minghinmatthewlam/pi-gui](https://github.com/minghinmatthewlam/pi-gui) 的 fork，汉化改动直接落在 `main`。跟进上游：

```bash
git remote add upstream https://github.com/minghinmatthewlam/pi-gui.git   # 若尚未添加
git fetch upstream
git merge upstream/main
```

英文原版说明见 [`README.en-US.md`](./README.en-US.md)。

## 已知问题

- 安装包未签名，会触发 SmartScreen 提示。
- 设置内的搜索目前仍按英文标题匹配，输入中文不会命中。
- 自定义/原生系统对话框的语言在切换到英文时不会立即同步（主进程语言尚未从界面同步）。
- 仓库自带的部分自动化测试断言英文文案，默认中文下会失配。

## 许可与致谢

- 本项目基于 [pi-gui](https://github.com/minghinmatthewlam/pi-gui)（作者 Matthew Lam）汉化，**上游版权归原作者所有**。
- 底层 Agent 为 [pi](https://github.com/earendil-works/pi)（Earendil Works），版权归其所有。
- 本项目同样以 [MIT License](./LICENSE) 发布；完整署名与第三方组件说明见 [NOTICE](./NOTICE)。

> 本项目为**非官方**第三方分支，未获上游作者或 Earendil Works 的赞助或背书。

欢迎提 Issue / PR 修正译文。
