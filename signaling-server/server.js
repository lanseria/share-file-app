/* eslint-disable no-console */
// signaling-server/server.js
import { createServer } from 'node:http' // <-- 1. 引入 http 模块
import { env } from 'node:process'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = env.PORT || 8080
const HEARTBEAT_INTERVAL = 30000 // 30秒

// 2. 首先创建一个 HTTP server
const server = createServer()

// 3. 将 WebSocketServer 附加到 HTTP server 上
// 注意，我们不再向 WebSocketServer 传递 'port'，而是传递 'server' 实例
const wss = new WebSocketServer({ server })

const ALLOWED_ORIGINS = [
  'http://localhost:3000', // Nuxt 开发环境
  'http://127.0.0.1:3000', // Nuxt 开发环境的另一种访问方式
  'https://share-file-nuxt.netlify.app', // 你的生产环境域名
  'https://spacex-launch-timeline-nuxt.netlify.app',
]

// 4. 为 HTTP server 添加请求监听器，用于展示一个简单的状态页面
server.on('request', (req, res) => {
  // WebSocket 的 'upgrade' 请求会被 `ws` 库自动处理，不会进入这里。
  // 因此，这里只处理普通的 HTTP 请求。
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>个人博客网站</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }

              body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background-color: #fafafa;
              }

              /* 导航栏 */
              .header {
                  background: #fff;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                  position: sticky;
                  top: 0;
                  z-index: 100;
              }

              .nav {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 1rem 1.5rem;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }

              .logo {
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: #2563eb;
                  text-decoration: none;
              }

              .nav-links {
                  display: flex;
                  gap: 1.5rem;
              }

              .nav-links a {
                  color: #666;
                  text-decoration: none;
                  font-size: 0.875rem;
                  transition: color 0.2s;
              }

              .nav-links a:hover {
                  color: #2563eb;
              }

              /* 主容器 */
              .container {
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 2rem 1.5rem;
              }

              /* 个人简介 */
              .profile {
                  background: #fff;
                  border-radius: 12px;
                  padding: 2rem;
                  margin-bottom: 2rem;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }

              .profile-header {
                  display: flex;
                  align-items: center;
                  gap: 1.5rem;
                  margin-bottom: 1.5rem;
              }

              .avatar {
                  width: 80px;
                  height: 80px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 2rem;
                  color: #fff;
              }

              .profile-info h1 {
                  font-size: 1.5rem;
                  margin-bottom: 0.5rem;
              }

              .profile-info .bio {
                  color: #666;
                  font-size: 0.9rem;
              }

              .profile-tags {
                  display: flex;
                  gap: 0.5rem;
                  flex-wrap: wrap;
              }

              .tag {
                  background: #f3f4f6;
                  color: #6b7280;
                  padding: 0.25rem 0.75rem;
                  border-radius: 9999px;
                  font-size: 0.75rem;
              }

              /* 博客文章 */
              .section-title {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-bottom: 1.5rem;
                  padding-bottom: 0.5rem;
                  border-bottom: 2px solid #e5e7eb;
              }

              .post {
                  background: #fff;
                  border-radius: 12px;
                  padding: 1.5rem;
                  margin-bottom: 1rem;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                  transition: transform 0.2s, box-shadow 0.2s;
                  cursor: pointer;
              }

              .post:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              }

              .post-title {
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: #2563eb;
                  margin-bottom: 0.5rem;
                  text-decoration: none;
                  display: block;
              }

              .post-excerpt {
                  color: #666;
                  font-size: 0.9rem;
                  margin-bottom: 1rem;
                  line-height: 1.7;
              }

              .post-meta {
                  display: flex;
                  gap: 1rem;
                  font-size: 0.8rem;
                  color: #999;
              }

              /* 服务器状态 */
              .status {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: #fff;
                  border-radius: 12px;
                  padding: 2rem;
                  margin-bottom: 2rem;
                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
              }

              .status-title {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-bottom: 1rem;
              }

              .status-item {
                  margin-bottom: 0.75rem;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
              }

              .status-dot {
                  width: 8px;
                  height: 8px;
                  background: #22c55e;
                  border-radius: 50%;
                  animation: pulse 2s infinite;
              }

              @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
              }

              .status-text {
                  font-size: 0.9rem;
              }

              /* 页脚 */
              .footer {
                  text-align: center;
                  padding: 2rem;
                  color: #999;
                  font-size: 0.875rem;
              }

              .footer a {
                  color: #999;
                  text-decoration: none;
              }

              .footer a:hover {
                  text-decoration: underline;
              }

              /* 响应式 */
              @media (max-width: 640px) {
                  .profile-header {
                      flex-direction: column;
                      text-align: center;
                  }

                  .profile-tags {
                      justify-content: center;
                  }
              }
          </style>
      </head>
      <body>
          <!-- 导航栏 -->
          <header class="header">
              <nav class="nav">
                  <a href="/" class="logo">🚀 ShareFile</a>
                  <div class="nav-links">
                      <a href="#">首页</a>
                      <a href="#">文章</a>
                      <a href="#">关于</a>
                  </div>
              </nav>
          </header>

          <!-- 主内容 -->
          <main class="container">
              <!-- 服务器状态 -->
              <div class="status">
                  <h2 class="status-title">🟢 服务状态</h2>
                  <div class="status-item">
                      <span class="status-dot"></span>
                      <span class="status-text">信令服务器运行中 - 端口: ${PORT}</span>
                  </div>
                  <div class="status-item">
                      <span class="status-text">WebSocket 端点: ws://localhost:${PORT}</span>
                  </div>
              </div>

              <!-- 个人简介 -->
              <div class="profile">
                  <div class="profile-header">
                      <div class="avatar">👨‍💻</div>
                      <div class="profile-info">
                          <h1>你好，我是开发者</h1>
                          <p class="bio">热爱开源，专注于 WebRTC 和实时通信技术。这个项目是一个基于 P2P 的文件分享应用。</p>
                      </div>
                  </div>
                  <div class="profile-tags">
                      <span class="tag">Vue.js</span>
                      <span class="tag">WebRTC</span>
                      <span class="tag">Node.js</span>
                      <span class="tag">TypeScript</span>
                      <span class="tag">开源</span>
                  </div>
              </div>

              <!-- 博客文章列表 -->
              <h2 class="section-title">📝 最新文章</h2>

              <article class="post">
                  <a href="#" class="post-title">WebRTC P2P 文件传输实现指南</a>
                  <p class="post-excerpt">详细介绍如何使用 WebRTC 的 DataChannel 实现点对点的文件传输，包括连接建立、分块传输、进度监控等关键技术点。</p>
                  <div class="post-meta">
                      <span>📅 2025-01-22</span>
                      <span>⏱️ 8 分钟阅读</span>
                      <span>🏷️ WebRTC</span>
                  </div>
              </article>

              <article class="post">
                  <a href="#" class="post-title">构建实时文件分享应用：架构设计与实践</a>
                  <p class="post-excerpt">分享这个 P2P 文件分享应用的完整架构设计思路，包括信令服务器设计、前端状态管理、错误处理等最佳实践。</p>
                  <div class="post-meta">
                      <span>📅 2025-01-20</span>
                      <span>⏱️ 10 分钟阅读</span>
                      <span>🏷️ 架构设计</span>
                  </div>
              </article>

              <article class="post">
                  <a href="#" class="post-title">Nuxt 4 Composition API 最佳实践</a>
                  <p class="post-excerpt">总结在项目中使用 Nuxt 4 和 Vue 3 Composition API 的经验，包括组合式函数设计、状态管理、性能优化等方面。</p>
                  <div class="post-meta">
                      <span>📅 2025-01-18</span>
                      <span>⏱️ 6 分钟阅读</span>
                      <span>🏷️ Vue.js</span>
                  </div>
              </article>

              <article class="post">
                  <a href="#" class="post-title">WebSocket 信令服务器从零搭建</a>
                  <p class="post-excerpt">手把手教你搭建一个高性能的 WebSocket 信令服务器，包含连接管理、消息转发、心跳检测等核心功能。</p>
                  <div class="post-meta">
                      <span>📅 2025-01-15</span>
                      <span>⏱️ 12 分钟阅读</span>
                      <span>🏷️ Node.js</span>
                  </div>
              </article>
          </main>

          <!-- 页脚 -->
          <footer class="footer">
              <p>
                  <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2025180399号-1</a>
              </p>
              <p style="margin-top: 0.5rem;">© 2025 ShareFile. All rights reserved.</p>
          </footer>
      </body>
      </html>
    `);
  }
  else {
    // 对于其他路径，可以返回 404
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

const rooms = new Map()
const clientsByWs = new Map()
const clientsById = new Map()

// 预设的头像和名称
const PRESET_AVATARS = [
  'i-twemoji-grinning-face-with-big-eyes',
  'i-twemoji-beaming-face-with-smiling-eyes',
  'i-twemoji-face-with-tears-of-joy',
  'i-twemoji-rolling-on-the-floor-laughing',
  'i-twemoji-smiling-face-with-halo',
  'i-twemoji-winking-face',
  'i-twemoji-star-struck',
  'i-twemoji-face-blowing-a-kiss',
  'i-twemoji-upside-down-face',
  'i-twemoji-zany-face',
  'i-twemoji-shushing-face',
  'i-twemoji-thinking-face',
  'i-twemoji-face-with-monocle',
  'i-twemoji-nerd-face',
  'i-twemoji-smiling-face-with-sunglasses',
  'i-twemoji-cowboy-hat-face',
  'i-twemoji-clown-face',
  'i-twemoji-ghost',
  'i-twemoji-alien',
  'i-twemoji-robot',
]
const PRESET_ADJECTIVES = ['开心', '聪明', '勇敢', '幸运', '快速', '安静', '友好', '好奇', '勤奋', '有趣']
const PRESET_NOUNS = ['猫咪', '小狗', '老虎', '狮子', '大象', '猴子', '熊猫', '兔子', '松鼠', '海豚']

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRandomUserData() {
  return {
    name: `${getRandomElement(PRESET_ADJECTIVES)}的${getRandomElement(PRESET_NOUNS)}`,
    avatar: getRandomElement(PRESET_AVATARS),
  }
}

wss.on('connection', (ws, req) => {
  // ... 你所有的 wss.on('connection', ...) 逻辑都保持完全不变 ...
  // --- 新增: 来源校验逻辑 ---
  const origin = req.headers.origin
  const clientIp = req.socket.remoteAddress // 获取客户端 IP

  console.log(`New connection attempt from origin: ${origin}, IP: ${clientIp}`)

  // 1. 检查 Origin 头是否在白名单中
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    // 2. 特殊情况：如果 Origin 不存在或不在白名单，我们再检查 Host 是否为 localhost
    // 这可以处理一些非浏览器客户端或特殊情况，但要注意安全风险
    const host = req.headers.host // 例如 'localhost:8080'
    const isLocalhost = host?.startsWith('localhost') || host?.startsWith('127.0.0.1')

    // 如果 Origin 不在白名单，并且 Host 也不是 localhost，则拒绝连接
    if (!ALLOWED_ORIGINS.includes(origin) && !isLocalhost) {
      console.warn(`Connection rejected: Origin "${origin}" is not in the allowed list.`)
      ws.terminate() // 使用 terminate 更直接地关闭底层连接
      return
    }
  }

  console.log(`Connection accepted from origin: ${origin}`)
  // 为每个连接生成一个唯一的客户端 ID
  const clientId = uuidv4()
  // 为新连接的客户端生成随机用户数据
  const userData = generateRandomUserData()
  const clientWrapper = { ws, id: clientId, roomId: null, ...userData } // 将 userData 合并

  clientsByWs.set(ws, clientWrapper)
  clientsById.set(clientId, clientWrapper) // 同时存入新的 Map

  console.log(`Client ${clientId} (${clientWrapper.name}) connected. Total clients: ${clientsByWs.size}`)

  clientWrapper.isAlive = true // 为每个客户端增加一个存活标记
  ws.on('pong', () => {
    console.log(`Pong received from ${clientWrapper.id}`)
    clientWrapper.isAlive = true
  })

  ws.on('message', (messageText) => {
    let message
    try {
      message = JSON.parse(messageText.toString())
    }
    catch (e) {
      console.error(`Error parsing message from ${clientId}:`, e)
      console.error(`Failed to parse message from ${clientId}:`, messageText.toString())
      ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON message' }))
      return
    }

    const currentClient = clientsByWs.get(ws)
    if (!currentClient)
      return

    console.log(`Received message from ${currentClient.id} (${currentClient.name}) in room ${currentClient.roomId || 'N/A'}:`, message)

    // 新增: 定义一个函数来处理需要转发的消息
    function forwardMessage(message) {
      const targetId = message.payload?.targetId
      if (!targetId) {
        console.error(`Message type ${message.type} requires a targetId.`)
        return
      }

      // 找到目标客户端
      // O(1) 查找！
      const targetClient = clientsById.get(targetId)

      if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        // 在转发的消息中附加上发送者的 ID
        const messageToSend = {
          type: message.type,
          payload: {
            ...message.payload,
            senderId: currentClient.id, // 让接收方知道是谁发来的
          },
        }
        targetClient.ws.send(JSON.stringify(messageToSend))

        console.log(`Forwarded ${message.type} from ${currentClient.id} to ${targetId}`)
      }
      else {
        console.warn(`Could not find or forward to target client ${targetId}`)
        // 可以给发送方一个反馈
        ws.send(JSON.stringify({ type: 'error', payload: `User ${targetId} not found or not connected.` }))
      }
    }

    switch (message.type) {
      case 'join_room': {
        const roomId = message.payload?.roomId
        if (!roomId || typeof roomId !== 'string') {
          ws.send(JSON.stringify({ type: 'error', payload: 'Invalid roomId for join_room' }))
          return
        }

        // 如果客户端已在其他房间，先离开
        if (currentClient.roomId && rooms.has(currentClient.roomId)) {
          const oldRoom = rooms.get(currentClient.roomId)
          oldRoom?.delete(currentClient)
          if (oldRoom?.size === 0) {
            rooms.delete(currentClient.roomId)

            console.log(`Room ${currentClient.roomId} is now empty and removed.`)
          }
          else {
            // 通知旧房间其他用户此人离开
            broadcastToRoom(currentClient.roomId, {
              type: 'user_left',
              payload: { id: currentClient.id },
            })
          }
        }

        currentClient.roomId = roomId
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        const room = rooms.get(roomId)
        if (!room)
          return // Should not happen

        // 1. 将房间内已存在的用户列表发送给新加入的用户
        const existingUsersInRoom = Array.from(room).map(client => ({
          id: client.id,
          name: client.name,
          avatar: client.avatar,
        }))
        ws.send(JSON.stringify({
          type: 'existing_users',
          payload: { users: existingUsersInRoom },
        }))

        // 2. 将新用户添加到房间
        room.add(currentClient)

        console.log(`Client ${currentClient.id} (${currentClient.name}) joined room ${roomId}. Room size: ${room.size}`)
        ws.send(JSON.stringify({
          type: 'room_joined',
          payload: {
            roomId,
            clientId: currentClient.id,
            id: currentClient.id,
            name: currentClient.name,
            avatar: currentClient.avatar,
          },
        }))

        // 3. 通知房间内其他用户有新人加入
        broadcastToRoom(roomId, {
          type: 'user_joined',
          payload: {
            id: currentClient.id,
            name: currentClient.name,
            avatar: currentClient.avatar,
          },
        }, currentClient.id) // 不发给自己
        break
      }

      case 'broadcast_message': {
        if (!currentClient.roomId) {
          ws.send(JSON.stringify({ type: 'error', payload: 'You are not in a room to broadcast.' }))
          return
        }
        if (!message.payload?.data) {
          ws.send(JSON.stringify({ type: 'error', payload: 'No data to broadcast.' }))
          return
        }

        console.log(`Broadcasting message from ${currentClient.id} in room ${currentClient.roomId}`)
        broadcastToRoom(currentClient.roomId, {
          type: 'room_message',
          payload: { senderId: currentClient.id, senderName: currentClient.name, data: message.payload.data },
        }, currentClient.id)
        break
      }

      // 新增: 处理 WebRTC 信令消息的转发
      case 'offer':
      case 'answer':
      case 'candidate':
      case 'file_transfer_request':
      case 'file_transfer_accepted':
      case 'file_transfer_rejected':
      case 'file_transfer_cancelled': {
        forwardMessage(message)
        break
      }
      default:{
        console.log(`Unknown message type from ${currentClient.id}: ${message.type}`)
        ws.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${message.type}` }))
      }
    }
  })

  ws.on('close', () => {
    const closingClient = clientsByWs.get(ws)
    if (!closingClient)
      return

    clientsByWs.delete(ws)
    clientsById.delete(closingClient.id) // 从 ID Map 中也删除

    console.log(`Client ${closingClient.id} (${closingClient.name}) disconnected. Total clients: ${clientsByWs.size}`)

    if (closingClient.roomId && rooms.has(closingClient.roomId)) {
      const room = rooms.get(closingClient.roomId)
      room?.delete(closingClient)

      console.log(`Client ${closingClient.id} removed from room ${closingClient.roomId}. Room size: ${room?.size}`)

      if (room?.size === 0) {
        rooms.delete(closingClient.roomId)

        console.log(`Room ${closingClient.roomId} is now empty and removed.`)
      }
      else {
        // 通知房间内其他用户有人离开 (可选，后续会用到)
        broadcastToRoom(closingClient.roomId, {
          type: 'user_left',
          payload: { id: closingClient.id },
        })
      }
    }
  })

  ws.on('error', (error) => {
    const errorClient = clientsByWs.get(ws)
    console.error(`WebSocket error for client ${errorClient?.id || 'unknown'}:`, error)
  })
})

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clientsByWs.get(ws)
    if (!client || client.isAlive === false) {
      console.warn(`Terminating dead connection for client ${client?.id || 'unknown'}`)
      return ws.terminate()
    }

    client.isAlive = false
    ws.ping(() => {
      console.log(`Ping sent to ${client.id}`)
    })
  })
}, HEARTBEAT_INTERVAL)

wss.on('close', () => {
  clearInterval(interval)
})

function broadcastToRoom(roomId, message, excludeClientId = null) {
  const room = rooms.get(roomId)
  if (room) {
    const messageString = JSON.stringify(message)
    room.forEach((client) => {
      if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageString)
        }
        catch (e) {
          console.error(`Failed to send message to client ${client.id} in room ${roomId}:`, e)
        }
      }
    })
  }
}

// 5. 启动 HTTP server，WebSocket server 会随之启动
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`)
  console.log(`- HTTP status page available at http://localhost:${PORT}`)
  console.log(`- WebSocket endpoint is ws://localhost:${PORT}`)
})
