# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目架构

这是一个基于 WebRTC 的 P2P 文件分享应用，采用前后端分离架构：

- **前端**: Nuxt 3/4 SPA 应用（`app/` 目录）
- **信令服务器**: 独立的 WebSocket 服务器（`signaling-server/` 目录）

### 核心通信流程

1. **房间连接**: 用户通过 WebSocket 连接信令服务器，加入房间
2. **WebRTC 建立连接**: 用户手动点击对方用户卡片触发 P2P 连接
3. **文件传输**: 使用 WebRTC DataChannel 进行分块传输（64KB chunks）

### 前端关键目录

- `app/composables/` - 核心逻辑
  - `useRoom.ts` - 房间管理逻辑
  - `useWebRtcManager.ts` - WebRTC 连接管理（核心）
  - `useFileTransfer.ts` - 文件传输逻辑
  - `constants.ts` - ICE 服务器配置和常量

### 信令服务器

- `signaling-server/server.js` - WebSocket 服务器（端口 8080/3000）
- 白名单 Origin 验证在 `ALLOWED_ORIGINS` 数组中配置

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动信令服务器（需要单独终端）
pnpm serve:ws

# 启动前端开发服务器
pnpm dev

# 构建
pnpm build

# 生成静态站点
pnpm generate

# 代码检查
pnpm lint

# 类型检查
pnpm typecheck
```

## 技术栈与代码规范

- **框架**: Nuxt 4 + Vue 3 (Composition API)
- **样式**: UnoCSS（原子化 CSS）
- **状态管理**: Pinia
- **工具库**: VueUse
- **代码规范**: @antfu/eslint-config（无分号、单引号、尾随逗号）

## 配置说明

### 信令服务器地址

通过环境变量 `NUXT_PUBLIC_SIGNALING_SERVER_URL` 配置，默认为 `ws://localhost:8080`

### ICE 服务器配置

在 `app/composables/constants.ts` 的 `ICE_SERVERS` 数组中配置 STUN/TURN 服务器

### 部署

- **信令服务器**: 使用 Docker 部署（见 Dockerfile），暴露端口 3000
- **前端**: 静态部署到 Netlify/Vercel 等，设置环境变量 `NUXT_PUBLIC_SIGNALING_SERVER_URL`
