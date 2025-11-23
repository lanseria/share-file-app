# ---- Stage 1: Build ----
FROM docker.m.daocloud.io/node:20-alpine AS builder

WORKDIR /app
COPY ./signaling-server/package.json ./
COPY ./pnpm-workspace.yaml ./
COPY ./pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install
COPY ./signaling-server/server.js /app/server.js 

# 将默认端口设置为你最常用的端口 3000
ENV PORT=3000

# 声明容器打算暴露的端口是 3000
EXPOSE 3000/tcp

# 设置非 root 用户运行，增加安全性 (可选但推荐)
USER node

# 容器启动时执行的命令
CMD [ "node", "server.js" ]