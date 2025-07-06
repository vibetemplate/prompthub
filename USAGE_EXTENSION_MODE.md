# PromptHub 扩展模式使用指南

本文档将指导您如何使用 `PromptHub` 最新的"扩展模式"。该模式通过一个配套的 Chrome 扩展来连接并控制一个由您手动启动的、常规的 Chrome 浏览器实例，旨在最大限度地绕过 Cloudflare 等高级机器人检测系统。

## 🚀 核心优势

- **高隐蔽性**: 由于控制的是一个真实的、非自动化的浏览器实例，因此几乎所有的浏览器指纹、环境和行为都与真人操作无异。
- **稳定性**: 避免了因浏览器被自动化工具接管而可能导致的各种不稳定问题。
- **高成功率**: 大幅提升了在受 Cloudflare 保护的网站上执行任务的成功率。

## 📋 准备工作

在开始之前，请确保您已经成功安装了 `PromptHub` 的所有开发依赖。

```bash
# 在项目根目录执行
npm install
```

## 🛠️ 操作步骤

### 步骤 1: 加载 `PromptHub Bridge` Chrome 扩展

您需要将我们创建的 `prompthub-extension` 作为一个"未打包的扩展"加载到您的 Chrome 浏览器中。

1.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions` 并回车。
2.  在右上角，打开 **"开发者模式"** 的开关。
3.  点击左上角的 **"加载已解压的扩展程序"** 按钮。
4.  在文件选择对话框中，找到并选择您本地项目中的 `prompthub-extension` 目录。
5.  点击"选择文件夹"后，您应该能在扩展列表中看到名为 "PromptHub Bridge" 的新卡片。

**注意**: 每次修改扩展的代码后，您都需要回到 `chrome://extensions` 页面，点击 "PromptHub Bridge" 卡片上的刷新按钮来重新加载它。

### 步骤 2: 启动 `PromptHub` 应用

现在，您可以像往常一样以开发模式启动 `PromptHub`。

```bash
# 在项目根目录执行
npm run dev
```

`main.ts` 中的 `USE_EXTENSION_MODE` 标志当前被硬编码为 `true`，因此应用启动后会自动进入"扩展模式"。您会在终端看到类似以下的日志：

```
🚀 启动扩展中继服务器...
✅ 中继服务器已在端口 9223 上启动
⏳ 等待Chrome扩展连接...
```

这表明 `PromptHub` 的中继服务器已经准备就绪，正在等待您的浏览器扩展连接。

### 步骤 3: 连接标签页

1.  打开一个新的 Chrome 标签页，并访问您想自动化的目标网站（例如 `https://chatgpt.com`）。
2.  点击浏览器右上角的 **`PromptHub Bridge` 扩展图标**。
3.  在弹出的窗口中，确保 "Bridge Server URL" 指向的是 `ws://localhost:9223/extension` (这是默认值)。
4.  点击 **"Share This Tab"** 按钮。

如果一切顺利，按钮会变为"Stop Sharing"，并且扩展图标上会显示一个绿色的 `●` 标记，表示该标签页已成功连接到 `PromptHub`。

### 步骤 4: 在 `PromptHub` 中操作

回到 `PromptHub` 的应用窗口。现在，当您通过 `PromptHub` 的界面执行"打开标签页"、"执行提示"等操作时，所有的指令都会被发送到您刚刚连接的那个真实的浏览器标签页中执行。

## ⚙️ 模式切换

如果您想切换回传统的、由 Playwright 自动启动浏览器的"持久化模式"，只需将 `prompthub/src/main/main.ts` 文件顶部的 `USE_EXTENSION_MODE` 常量修改为 `false` 即可。

```typescript
// prompthub/src/main/main.ts

// 🔥 切换到扩展模式 (修改这里)
const USE_EXTENSION_MODE = false 
```

---
*祝您使用愉快！* 