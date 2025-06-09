# Share File App - P2P 文件分享应用

这是一个基于 WebRTC 技术实现的现代化、安全、快速的点对点（P2P）文件分享应用。无需将文件上传到任何服务器，数据直接在用户浏览器之间传输。

[![Netlify Status](https://api.netlify.com/api/v1/badges/53013dec-e937-4d9b-9140-a756fafd5209/deploy-status)](https://app.netlify.com/sites/share-file-nuxt/deploys)
![Nuxt](https://img.shields.io/badge/Nuxt-3.17-00DC82?logo=nuxt.js)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript)
![UnoCSS](https://img.shields.io/badge/UnoCSS-gray?logo=unocss)

## ✨ 功能特性

- **真正的 P2P 传输**: 文件不经过服务器中转，保护隐私，速度更快。
- **多用户房间**: 创建一个房间，分享链接给多个朋友，即可实现多人互传。
-
- **暗黑模式**: 自动或手动切换，适应不同环境。
- **响应式设计**: 在桌面和移动设备上均有良好体验。
- **专业级调试工具**:
  - 动态配置 STUN/TURN 服务器。
  - 实时查看 ICE 候选者收集日志。
  - 手动触发 NAT 类型检测，帮助诊断连接问题。
- **随机身份**: 无需注册，进入房间即可获得一个可爱的随机头像和昵称。

## 🚀 在线体验

[https://share-file-nuxt.netlify.app](https://share-file-nuxt.netlify.app) <!-- 替换为您的线上地址 -->

## 🛠️ 技术栈

### 前端

- **框架**: [Nuxt 3](https://nuxt.com/) (v3.17.4) + [Vue 3](https://vuejs.org/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [UnoCSS](https://unocss.dev/) - 即时原子化 CSS 引擎
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **代码规范**: [@antfu/eslint-config](https://github.com/antfu/eslint-config)

### 信令服务器 (Signaling Server)

- **环境**: [Node.js](https://nodejs.org/)
- **核心库**: [ws](https://github.com/websockets/ws) - 高性能 WebSocket 库

## 📖 使用指南

1.  **打开应用**: 访问线上地址。
2.  **创建房间**: 在首页点击“创建新房间”，应用会自动生成一个唯一的房间链接。
3.  **分享链接**: 将房间链接（URL）分享给您想与之分享文件的朋友。
4.  **建立连接**:
    - 朋友打开链接后会加入同一个房间。
    - 默认情况下，连接是未建立的。点击对方用户卡片上的状态图标（如 "未连接"）来手动发起 WebRTC 连接。
5.  **发送文件**: 连接成功后（状态变为 "已连接"），点击对方的用户卡片，即可选择文件进行发送。
6.  **接收文件**: 对方接受请求后，文件将开始传输，并在完成后自动触发下载。

## 🔧 开发与部署

### 本地开发

**环境要求**:

- Node.js (建议 v18.x 或更高版本)
- pnpm (v10.x 或更高版本)

**步骤**:

1.  **克隆仓库**:

    ```bash
    git clone https://github.com/lanseria/share-file-app.git
    cd share-file-app
    ```

2.  **安装依赖**:

    ```bash
    pnpm install
    ```

3.  **启动信令服务器**:
    在一个终端中运行：

    ```bash
    pnpm serve:ws
    ```

    信令服务器将启动在 `ws://localhost:8080`。

4.  **启动 Nuxt 前端应用**:
    在另一个终端中运行：

    ```bash
    pnpm dev
    ```

    前端应用将启动在 `http://localhost:3000`。

5.  打开浏览器访问 `http://localhost:3000` 即可开始开发。

### 部署信令服务器 (使用 Docker)

项目根目录下已包含一个 `Dockerfile` 用于构建信令服务器的 Docker 镜像。

1.  **构建镜像**:

    ```bash
    docker build -t my-signaling-server:latest .
    ```

2.  **运行容器**:
    以下命令将停止并移除旧的容器（如果存在），然后以后台模式启动一个新的容器，将主机的 3000 端口映射到容器的 8080 端口，并设置了自动重启策略。

    ```bash
    # 停止并移除同名旧容器（可选，用于更新）
    docker stop signaling-server
    docker rm signaling-server

    # 启动新容器
    docker run -d \
     -p 3000:8080 \
     --name signaling-server \
     --restart unless-stopped \
     my-signaling-server:latest
    ```

    现在，您的信令服务器就在 `ws://your-server-ip:3000` 上运行了。

### 部署前端应用

前端是一个标准的 Nuxt 3 应用，可以轻松部署到任何支持 Node.js 的平台，如 Netlify, Vercel, 或您自己的服务器。

- **对于 Netlify/Vercel**:

  1.  Fork 本仓库。
  2.  在您的 Netlify/Vercel 账户中，从 Git 导入新项目。
  3.  设置构建命令为 `nuxt build`。
  4.  设置发布目录为 `.output/public`。
  5.  **重要**: 设置环境变量 `NUXT_PUBLIC_SIGNALING_SERVER_URL` 为您部署的信令服务器地址（例如 `wss://your-ws-domain.com`）。

- **静态托管**:
  ```bash
  pnpm generate
  ```
  然后将 `.output/public` 目录下的内容部署到任何静态文件服务器。

## 💡 许可证

[MIT](./LICENSE) License © 2024 [Your Name]
