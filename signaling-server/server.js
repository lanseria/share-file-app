// signaling-server/server.js
import { env } from 'node:process'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = env.PORT || 8080
const wss = new WebSocketServer({ port: PORT })
// --- 新增: 定义允许的来源 (白名单) ---
// 注意: WebSocket 的 Origin 头可能不包含端口号，也可能是 null (例如非浏览器客户端)
// 对于浏览器，它通常是 `http://hostname:port` 或 `https://hostname:port`
const ALLOWED_ORIGINS = [
  'http://localhost:3000', // Nuxt 开发环境
  'http://127.0.0.1:3000', // Nuxt 开发环境的另一种访问方式
  'https://share-file-nuxt.netlify.app', // 你的生产环境域名
]
// 用于存储房间和客户端连接信息
// 结构:
// rooms = {
//   "roomId1": Set<WebSocketClientWrapper>,
//   "roomId2": Set<WebSocketClientWrapper>,
//   ...
// }
// WebSocketClientWrapper = { ws: WebSocket, id: string, roomId: string | null }
const rooms = new Map()
const clients = new Map()

// eslint-disable-next-line no-console
console.log(`Signaling server started on ws://localhost:${PORT}`)
// eslint-disable-next-line no-console
console.log('Allowed origins:', ALLOWED_ORIGINS.join(', '))

// 预设的头像和名称，用于随机分配
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
  // --- 新增: 来源校验逻辑 ---
  const origin = req.headers.origin
  const clientIp = req.socket.remoteAddress // 获取客户端 IP

  // eslint-disable-next-line no-console
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

  // eslint-disable-next-line no-console
  console.log(`Connection accepted from origin: ${origin}`)
  // 为每个连接生成一个唯一的客户端 ID
  const clientId = uuidv4()
  // 为新连接的客户端生成随机用户数据
  const userData = generateRandomUserData()
  const clientWrapper = { ws, id: clientId, roomId: null, ...userData } // 将 userData 合并
  clients.set(ws, clientWrapper)

  // eslint-disable-next-line no-console
  console.log(`Client ${clientId} (${clientWrapper.name}) connected. Total clients: ${clients.size}`)

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

    const currentClient = clients.get(ws)
    if (!currentClient)
      return

    // eslint-disable-next-line no-console
    console.log(`Received message from ${currentClient.id} (${currentClient.name}) in room ${currentClient.roomId || 'N/A'}:`, message)

    // 新增: 定义一个函数来处理需要转发的消息
    function forwardMessage(message) {
      const targetId = message.payload?.targetId
      if (!targetId) {
        console.error(`Message type ${message.type} requires a targetId.`)
        return
      }

      // 找到目标客户端
      let targetClient = null
      // clients Map 的 key 是 ws 对象, value 是 clientWrapper, 所以需要遍历查找
      for (const client of clients.values()) {
        if (client.id === targetId) {
          targetClient = client
          break
        }
      }

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
        // eslint-disable-next-line no-console
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
            // eslint-disable-next-line no-console
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

        // eslint-disable-next-line no-console
        console.log(`Client ${currentClient.id} (${currentClient.name}) joined room ${roomId}. Room size: ${room.size}`)
        ws.send(JSON.stringify({
          type: 'room_joined',
          payload: {
            roomId,
            clientId: currentClient.id,
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

        // eslint-disable-next-line no-console
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

      default:
        // eslint-disable-next-line no-console
        console.log(`Unknown message type from ${currentClient.id}: ${message.type}`)
        ws.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${message.type}` }))
    }
  })

  ws.on('close', () => {
    const closingClient = clients.get(ws)
    if (!closingClient)
      return

    clients.delete(ws)
    // eslint-disable-next-line no-console
    console.log(`Client ${closingClient.id} (${closingClient.name}) disconnected. Total clients: ${clients.size}`)

    if (closingClient.roomId && rooms.has(closingClient.roomId)) {
      const room = rooms.get(closingClient.roomId)
      room?.delete(closingClient)
      // eslint-disable-next-line no-console
      console.log(`Client ${closingClient.id} removed from room ${closingClient.roomId}. Room size: ${room?.size}`)

      if (room?.size === 0) {
        rooms.delete(closingClient.roomId)
        // eslint-disable-next-line no-console
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
    const errorClient = clients.get(ws)
    console.error(`WebSocket error for client ${errorClient?.id || 'unknown'}:`, error)
    // 可以在这里尝试清理该客户端的连接和房间信息，类似 'close' 事件处理
  })
})

// 辅助函数：向指定房间广播消息
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
          // 可以在这里处理发送失败的客户端，比如将其从房间移除
        }
      }
    })
  }
}
