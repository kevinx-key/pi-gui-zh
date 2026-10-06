/*
 * Simplified Chinese dictionary, keyed by the English source string.
 *
 * `t("English source")` looks up the entry here and falls back to the English source
 * when an entry is missing, so this file can be filled in incrementally without ever
 * leaving a blank string on screen. Keep entries grouped by area and alphabetical-ish
 * for easy scanning.
 */
export const zhCN: Readonly<Record<string, string>> = {
  // ── Settings · Appearance ─────────────────────────────
  "Interface language": "界面语言",
  "Choose the language used across the app.": "选择应用界面使用的语言。",
  Theme: "主题",
  "Color preset": "配色方案",
  "Window transparency": "窗口透明",
  "Let desktop colors show through supported surfaces.": "让支持的界面透出桌面颜色。",
  System: "跟随系统",
  Light: "浅色",
  Dark: "深色",
  Default: "默认",
  "The pi-gui palette.": "pi-gui 配色。",
  "Soft pastel Latte and Mocha variants.": "柔和的 Latte 和 Mocha 配色变体。",
  "A cool editor palette with a bright Day variant.": "冷色调编辑器配色，带有明亮的 Day 变体。",
  "Low-contrast arctic neutrals and blue accents.": "低对比度的北极中性色与蓝色点缀。",
  "Dracula and its official Alucard light variant.": "Dracula 及其官方 Alucard 浅色变体。",
  "Warm retro contrast.": "温暖的复古对比。",
  "GitHub-style light and dark surfaces.": "GitHub 风格的浅色与深色界面。",
  "Familiar editor colours with blue accents.": "熟悉的编辑器配色，带蓝色点缀。",

  // ── Settings · Sections ───────────────────────────────
  App: "应用",
  Agent: "智能体",
  General: "通用",
  Appearance: "外观",
  Notifications: "通知",
  "Keyboard shortcuts": "快捷键",
  Providers: "提供商",
  Models: "模型",
  "MCP servers": "MCP 服务器",
  "Skills and extensions": "技能与扩展",
  Customize: "自定义",
  "App and runtime defaults.": "应用与运行时默认值。",
  "Choose light, dark or system mode and a color preset.":
    "选择浅色、深色或跟随系统模式以及配色方案。",
  "Choose which background events alert you.": "选择哪些后台事件会通知你。",
  "Shortcuts available across the app.": "应用内可用的快捷键。",
  "Connect providers and manage auth for {workspace}.": "为 {workspace} 连接提供商并管理认证。",
  "Choose the default model and which models appear in pickers.":
    "选择默认模型以及出现在选择器中的模型。",
  "Add, remove and switch the MCP servers pi connects in each thread.":
    "添加、移除并切换 pi 在每个线程中连接的 MCP 服务器。",
  "Select a workspace": "选择工作区",
  "Providers and models are set per workspace. Choose one, or open a folder first.":
    "提供商和模型按工作区设置。请选择一个工作区，或先打开一个文件夹。",
  "this workspace": "此工作区",
  "Choose…": "请选择…",

  // ── Settings · General ────────────────────────────────
  "Model settings scope": "模型设置范围",
  "Apply the default model and enabled models everywhere, or set them per repo.":
    "在所有位置应用默认模型和已启用模型，或按仓库分别设置。",
  "App global": "应用全局",
  "Per repo": "按仓库",
  "Skill slash commands": "技能斜杠命令",
  "Offer each skill as a slash command in the composer.": "在输入框中将每个技能作为斜杠命令提供。",
  "Enable skill slash commands": "启用技能斜杠命令",
  Terminal: "终端",
  "The shell the integrated terminal starts. Leave blank to use your login shell.":
    "集成终端启动时使用的 shell。留空则使用你的登录 shell。",
  "Shell of integrated terminal": "集成终端的 shell",

  // ── Settings · Notifications ──────────────────────────
  "System notifications": "系统通知",
  "macOS decides whether pi-gui can show desktop notifications at all.":
    "macOS 决定 pi-gui 能否显示桌面通知。",
  "macOS notification access": "macOS 通知权限",
  "Turn on notifications": "开启通知",
  "pi-gui asks macOS when active work first moves into the background. You can also ask now.":
    "当活跃工作首次转入后台时 pi-gui 会向 macOS 请求权限。你也可以现在请求。",
  "macOS notifications are already turned off for pi-gui. Open System Settings to enable them again.":
    "macOS 通知已对 pi-gui 关闭。请打开系统设置重新启用。",
  "Ask macOS": "向 macOS 请求",
  "Open System Settings": "打开系统设置",
  "In-app alerts": "应用内提醒",
  "Choose which background events should try to notify once macOS access is enabled.":
    "选择在启用 macOS 权限后哪些后台事件会尝试通知。",
  "Background completion": "后台完成",
  "Notify when a background session finishes.": "后台会话完成时通知。",
  "Background failures": "后台失败",
  "Notify when a background session fails.": "后台会话失败时通知。",
  "Needs input or approval": "需要输入或批准",
  "Notify when input is needed to continue.": "继续需要输入时通知。",
  Enabled: "已启用",
  "Turned off": "已关闭",
  "Not enabled yet": "尚未启用",
  Unavailable: "不可用",
  "Checking…": "检查中…",
  "macOS will allow pi-gui to show desktop notifications for background thread updates.":
    "macOS 将允许 pi-gui 为后台线程更新显示桌面通知。",
  "macOS notifications are turned off for pi-gui. Enable them in System Settings to receive background completion alerts.":
    "macOS 通知已对 pi-gui 关闭。请在系统设置中启用，以接收后台完成提醒。",
  "pi-gui has not asked macOS for desktop notification access yet.":
    "pi-gui 尚未向 macOS 请求桌面通知权限。",
  "Desktop notifications are unavailable on this system.": "此系统不支持桌面通知。",
  "Checking whether macOS notifications are available for pi-gui.":
    "正在检查 pi-gui 是否可使用 macOS 通知。",

  // ── Settings · Shortcuts ──────────────────────────────
  Threads: "线程",
  Composer: "输入框",
  Workbench: "工作台",
  "Command palette": "命令面板",
  "Go to file": "转到文件",
  "Open settings": "打开设置",
  "Toggle sidebar": "切换侧边栏",
  "Toggle side panel": "切换侧面板",
  "New window": "新建窗口",
  "New thread": "新建线程",
  "Switch to recent thread": "切换到最近的线程",
  "Cycle through threads": "在线程间循环切换",
  "Find in thread": "在线程中查找",
  "Send message, or queue it during a run": "发送消息，或在运行时排队",
  "Steer the running agent": "引导正在运行的智能体",
  "New line": "换行",
  "Toggle terminal": "切换终端",
  "New terminal tab": "新建终端标签页",
  "Toggle review": "切换审查",
  "Switch to side panel tab": "切换到侧面板标签页",
  "Close workbench tab": "关闭工作台标签页",

  // ── Settings · Providers ──────────────────────────────
  "OAuth · connected": "OAuth · 已连接",
  "API key · connected": "API 密钥 · 已连接",
  "Environment variable · connected": "环境变量 · 已连接",
  "Configured externally · connected": "外部配置 · 已连接",
  "Configure externally": "在外部配置",
  "OAuth or API key": "OAuth 或 API 密钥",
  "API key": "API 密钥",
  "Built in": "内置",
  Login: "登录",
  Logout: "退出登录",
  Manage: "管理",
  "Set API key": "设置 API 密钥",
  "Needs attention": "需要处理",
  "Your default model uses this provider, but it is not connected.":
    "你的默认模型使用此提供商，但尚未连接。",
  Connected: "已连接",
  "pi picks models from connected providers first.": "pi 优先从已连接的提供商中选择模型。",
  "No providers connected yet. Sign in or add an API key below.":
    "尚未连接任何提供商。请在下方登录或添加 API 密钥。",
  Available: "可用",
  "Search providers": "搜索提供商",
  "Sign in with OAuth or save an API key to connect a provider.":
    "使用 OAuth 登录或保存 API 密钥以连接提供商。",
  "No providers match “{query}”.": "没有匹配“{query}”的提供商。",
  "Every provider is connected.": "所有提供商都已连接。",
  "Show {count} more": "再显示 {count} 个",
  "Manage API key": "管理 API 密钥",
  "Replace or remove the saved API key for {name}.": "替换或移除 {name} 已保存的 API 密钥。",
  "Save an API key locally for {name}.": "在本地为 {name} 保存 API 密钥。",
  "{name} API key": "{name} API 密钥",
  "Enter API key": "输入 API 密钥",
  Cancel: "取消",
  "Remove saved key": "移除已保存的密钥",
  "Save key": "保存密钥",

  // ── Settings · Models ─────────────────────────────────
  "Default model": "默认模型",
  "Used for new threads.": "用于新线程。",
  Reasoning: "推理",
  "Default reasoning effort for new threads.": "新线程的默认推理力度。",
  "Your default model ({provider}/{modelId}) is turned off or its provider is not connected. Choose a new default.":
    "你的默认模型（{provider}/{modelId}）已关闭或其提供商未连接。请选择新的默认模型。",
  "Enabled models": "已启用模型",
  "{enabled} of {total}": "{enabled} / {total}",
  "Search models": "搜索模型",
  "Only enabled models appear in model pickers.": "只有已启用的模型会出现在模型选择器中。",
  "No connected models available yet. Connect a provider to add models.":
    "尚无已连接的可用模型。连接提供商以添加模型。",
  "No connected models match “{query}”.": "没有匹配“{query}”的已连接模型。",
  "Enable {name}": "启用 {name}",
  "Not connected": "未连接",
  "Connect a provider": "连接提供商",
  "Models from providers you have not signed in to.": "来自你尚未登录的提供商的模型。",
  "Show {count} models": "显示 {count} 个模型",
  Images: "图片",
  Low: "低",
  Medium: "中",
  High: "高",
  "Extra High": "极高",
  Max: "最高",

  // ── Settings · MCP servers ────────────────────────────
  Servers: "服务器",
  "Shared with pi in the terminal: {path}, plus this project's .pi/mcp.json.":
    "与终端中的 pi 共享：{path}，以及本项目的 .pi/mcp.json。",
  "No MCP servers yet. Servers come from {path}, which pi in the terminal uses too. Connection status and sign-in show in threads: type /mcp.":
    "尚无 MCP 服务器。服务器来自 {path}，终端中的 pi 也使用它。连接状态和登录信息在线程中显示：输入 /mcp。",
  "This project · {target}": "本项目 · {target}",
  Remove: "移除",
  "Code mode": "代码模式",
  "Always on": "始终开启",
  "Lets the model run scripts that call tools. Turning it on also applies to open threads; turning it off applies to new threads. Off, pi turns it on when an MCP server needs it.":
    "允许模型运行调用工具的脚本。开启也会应用于已打开的线程；关闭应用于新线程。关闭时，pi 会在 MCP 服务器需要时开启。",
  "Code mode always on": "代码模式始终开启",
  'Remove MCP server "{name}"? pi in the terminal stops using it too.':
    "移除 MCP 服务器“{name}”？终端中的 pi 也将停止使用它。",
  'Remove MCP server "{name}"? pi in the terminal stops using it too. Its hidden settings (environment variables, headers, sign-in config) are deleted too.':
    "移除 MCP 服务器“{name}”？终端中的 pi 也将停止使用它。其隐藏设置（环境变量、请求头、登录配置）也会一并删除。",
  "Add server": "添加服务器",
  "Saved to {path}.": "保存到 {path}。",
  Name: "名称",
  "Server name": "服务器名称",
  "What it does": "功能说明",
  "Optional. pi tells the model about the server with it.": "可选。pi 用它向模型介绍该服务器。",
  "Server description": "服务器描述",
  "Searches the team's docs": "搜索团队的文档",
  Type: "类型",
  "Server type": "服务器类型",
  Command: "命令",
  "Started on this machine for each thread.": "每个线程在本机启动。",
  "Server command": "服务器命令",
  Arguments: "参数",
  "Separated by spaces; quote an argument that contains spaces.":
    "以空格分隔；包含空格的参数请加引号。",
  "Server arguments": "服务器参数",
  "A streamable HTTP server. If it needs a sign-in, type /mcp login in a thread.":
    "可流式传输的 HTTP 服务器。如需登录，请在线程中输入 /mcp login。",
  "Server URL": "服务器 URL",
  "Open threads reload to start it. Add env or headers in the file itself.":
    "已打开的线程会重新加载以启动它。请在文件中添加环境变量或请求头。",

  // ── Settings · Custom endpoints ───────────────────────
  "Custom endpoints": "自定义端点",
  "Add OpenAI-compatible endpoints (Ollama, vLLM, or your own server). Stored in ~/.pi/agent/models.json.":
    "添加兼容 OpenAI 的端点（Ollama、vLLM 或你自己的服务器）。存储在 ~/.pi/agent/models.json。",
  "No custom endpoints yet.": "尚无自定义端点。",
  "{count} models": "{count} 个模型",
  Edit: "编辑",
  "Add endpoint": "添加端点",
  "Register a local or custom OpenAI-compatible server.": "注册本地或自定义的兼容 OpenAI 服务器。",
  "Edit custom endpoint": "编辑自定义端点",
  "Add custom endpoint": "添加自定义端点",
  "Configure an OpenAI-compatible server. The endpoint and API key are stored in plaintext at":
    "配置兼容 OpenAI 的服务器。端点和 API 密钥以明文存储在",
  "Provider ID": "提供商 ID",
  "Lowercase letters, digits, and dashes. Cannot be changed later.":
    "仅限小写字母、数字和连字符。之后无法更改。",
  "Base URL": "基础 URL",
  "Include the": "在末尾包含",
  "suffix. Ollama:": "后缀。Ollama：",
  "vLLM:": "vLLM：",
  "vLLM: pass through; Ollama: leave blank": "vLLM：直接透传；Ollama：留空",
  "Required by the storage format. For vLLM started with":
    "存储格式要求必填。对于以如下参数启动的 vLLM",
  ", enter that key. For Ollama or other servers without auth, leave blank and a placeholder is saved.":
    "，请输入该密钥。对于无需认证的 Ollama 或其他服务器，留空即可，将保存一个占位符。",
  "Detecting…": "检测中…",
  "Detect models": "检测模型",
  "Tool calling is required. Smaller models (< 7B) often do not emit OpenAI-style function calls cleanly.":
    "需要支持工具调用。较小的模型（< 7B）通常无法干净地发出 OpenAI 风格的功能调用。",
  "Save changes": "保存更改",
  "Click “Detect models” or type a model ID below to add one manually.":
    "点击“检测模型”，或在下方输入模型 ID 手动添加。",
  "Add model ID manually": "手动添加模型 ID",
  Add: "添加",
  "Provider ID is required.": "提供商 ID 为必填项。",
  "Use lowercase letters, digits, and dashes (max 64 chars).":
    "请使用小写字母、数字和连字符（最多 64 个字符）。",
  'Provider ID "{name}" is already in use.': "提供商 ID“{name}”已被使用。",
  "Desktop bridge is not available.": "桌面桥接不可用。",
  "Base URL must start with http:// or https://": "基础 URL 必须以 http:// 或 https:// 开头",
  "Select at least one model.": "请至少选择一个模型。",

  // ── Model onboarding ──────────────────────────────────
  "No models available": "无可用模型",
  "Selected model unavailable": "所选模型不可用",
  "No default model set": "未设置默认模型",
  "Default model unavailable": "默认模型不可用",
  "All available models are currently disabled. Open Settings > Models to enable models.":
    "所有可用模型当前均被禁用。打开 设置 > 模型 以启用模型。",
  "Connect a provider in Settings > Providers before choosing a model or setting a default.":
    "在 设置 > 提供商 中连接提供商，然后再选择模型或设置默认值。",
  "The model selected for this thread is no longer available. Choose another model, then open Settings > Models to update the default.":
    "为此线程选择的模型已不可用。请选择其他模型，然后打开 设置 > 模型 更新默认值。",
  "The model selected for this thread is no longer available. Choose another model, then open Settings > Models to choose the app default.":
    "为此线程选择的模型已不可用。请选择其他模型，然后打开 设置 > 模型 选择应用默认值。",
  "Set a default model in Settings > Models.": "在 设置 > 模型 中设置默认模型。",
  "Open Settings > Models": "打开 设置 > 模型",
  "Open Settings > Providers": "打开 设置 > 提供商",

  // ── App shell ─────────────────────────────────────────
  "Back to app": "返回应用",
  "{title} sections": "{title}分区",
  "Search {title}": "搜索{title}",
  Search: "搜索",
  "No matches for “{query}”": "没有匹配“{query}”的结果",
  "Open a folder to begin": "打开文件夹以开始",
  "Hide side panel": "隐藏侧面板",
  "Show side panel": "显示侧面板",
  "Loading sessions": "正在加载会话",
  "The desktop shell is restoring folder and thread state from the main process.":
    "桌面外壳正在从主进程恢复文件夹与线程状态。",
  "Couldn't restore sessions": "无法恢复会话",
  "The desktop shell couldn't read folder and thread state. Retry, or relaunch the app.":
    "桌面外壳无法读取文件夹与线程状态。请重试，或重新启动应用。",
  "The desktop shell isn't connected. Quit pi-gui and reopen it.":
    "桌面外壳未连接。请退出 pi-gui 并重新打开。",
  "Something went wrong": "出了点问题",
  "The desktop window hit an unexpected error. Retry to remount, or relaunch the app.":
    "桌面窗口遇到意外错误。请重试以重新挂载，或重新启动应用。",
  "Retrying…": "重试中…",
  Retry: "重试",
  "Relaunch pi-gui": "重新启动 pi-gui",
  "Select a workspace first.": "请先选择工作区。",
  Workspace: "工作区",
  Settings: "设置",
  "Thread actions": "线程操作",
  "Some saved workspaces could not be refreshed.": "部分已保存的工作区无法刷新。",
  "{name} is unavailable.": "{name} 不可用。",
  "Open a folder to start": "打开文件夹以开始",
  "Add a project folder before creating a new thread.": "创建新线程前请先添加项目文件夹。",
  "This session was written by a newer version of pi — some content may not display. Update pi-gui (or open it with the pi CLI) to see everything.":
    "此会话由更新版本的 pi 写入 —— 部分内容可能无法显示。请更新 pi-gui（或使用 pi CLI 打开）以查看全部内容。",
  "Dismiss notice": "关闭通知",
  Dismiss: "关闭",
  "Create a thread for this folder, then jump between sessions from the sidebar.":
    "为此文件夹创建线程，然后从侧边栏在会话间跳转。",
  "Add project folders, group sessions under them, and jump between threads from the sidebar.":
    "添加项目文件夹，在其下归组会话，并从侧边栏在线程间跳转。",
  "This file checkout is unavailable.": "此文件检出不可用。",
};
