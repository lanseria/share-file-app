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

# --- 关键部分：设置环境变量 ---

# 1. 为 PORT 设置一个默认值。
#    这个值可以在 `docker run` 时被覆盖。
#    它会告诉 Node.js 应用默认监听 8080 端口。
ENV PORT=8080

# 2. 为 SERVER_PUBLIC_IP 设置一个空的默认值。
#    这强制要求在运行时必须提供这个环境变量，否则应用可能无法正常工作。
#    这是一种很好的实践，避免了将生产环境的敏感信息或易变信息硬编码。
# ENV SERVER_PUBLIC_IP="107.191.41.14"

# 暴露信令服务器运行的端口
# EXPOSE 只是文档性的，告诉Docker这个容器打算使用哪个端口。
# 它本身不会发布端口。实际发布端口是在 `docker run` 时用 -p 参数。
EXPOSE 8080/tcp
EXPOSE 40000-40100/udp

# 设置非 root 用户运行，增加安全性 (可选但推荐)
USER node

# 容器启动时执行的命令
CMD [ "node", "server.js" ]