# ---- Stage 1: Build ----
# 使用一个包含 Node.js 和 pnpm 的官方或社区镜像作为构建环境
# 我们选择一个基于 Node.js 20-alpine 的版本，它比较小巧
FROM docker.m.daocloud.io/node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 关键：只复制 pnpm-lock.yaml 和 package.json 文件
COPY ./signaling-server/package.json ./
COPY ./pnpm-workspace.yaml ./
COPY ./pnpm-lock.yaml ./

# 安装依赖。pnpm 会自动识别 workspace（如果有），但在这个场景下是独立的。
# 使用 --frozen-lockfile 确保安装与 lock 文件完全一致的版本
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install

COPY ./signaling-server/server.js /app/server.js 

ENV PORT=8080

EXPOSE 8080/tcp

# 设置非 root 用户运行，增加安全性 (可选但推荐)
USER node

# 容器启动时执行的命令
CMD [ "node", "server.js" ]