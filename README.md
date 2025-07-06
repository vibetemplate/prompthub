# PromptHub - AI工作流自动化中心

一个基于浏览器自动化的提示词管理与执行平台，专为AI Power User打造。

## 项目特色

- **纯浏览器自动化**: 无需API Key，完全免费使用
- **多网站支持**: 支持DeepSeek、ChatGPT、Claude、Gemini等主流AI网站
- **提示词库管理**: 树状结构管理，支持分类和标签
- **一键执行**: 提示词一键注入到目标网站
- **反检测机制**: 使用stealth插件规避反爬检测

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design
- **后端**: Electron + Node.js
- **浏览器自动化**: Puppeteer + puppeteer-extra-plugin-stealth
- **状态管理**: Zustand + Immer
- **构建工具**: Vite

## 开发环境设置

1. 安装依赖：
```bash
npm install
```

2. 启动开发模式：
```bash
npm run dev
```

3. 构建项目：
```bash
npm run build
```

4. 打包应用：
```bash
npm run package
```

## 项目结构

```
prompthub/
├── src/
│   ├── main/                 # Electron主进程
│   │   ├── data/            # 数据管理
│   │   ├── ipc/             # IPC通信
│   │   ├── puppeteer/       # 浏览器自动化
│   │   │   └── adapters/    # 网站适配器
│   │   └── utils/           # 工具函数
│   └── renderer/            # React渲染进程
│       └── src/
│           ├── components/  # React组件
│           ├── stores/      # 状态管理
│           └── types/       # TypeScript类型
├── dist/                    # 构建输出
└── release/                 # 打包输出
```

## 主要功能

### 1. 提示词库管理
- 树状结构的提示词管理
- 支持文件夹分类
- 提示词编辑和标签管理
- 导入导出功能

### 2. 浏览器自动化
- 多标签页浏览器控制
- 智能网站类型识别
- 提示词自动注入
- 响应等待机制

### 3. 网站适配器
- DeepSeek适配器
- ChatGPT适配器
- 统一的适配器接口
- 可扩展的网站支持

## 使用方法

1. 启动应用后，点击"打开网站"选择目标AI网站
2. 在左侧提示词库中选择或创建提示词
3. 编辑提示词内容和目标网站
4. 点击"执行"按钮，提示词将自动注入到网站

## 开发计划

- [x] 基础架构搭建
- [ ] 提示词库系统完善
- [ ] 浏览器自动化集成
- [ ] 网站适配器开发
- [ ] 用户界面优化
- [ ] 高级功能实现
