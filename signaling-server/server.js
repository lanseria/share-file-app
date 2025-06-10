// signaling-server/server.js
import dgram from 'node:dgram' // <--- 新增: 引入dgram模块用于UDP操作
import { env } from 'node:process'
import { v4 as uuidv4 } from 'uuid'
import { WebSocket, WebSocketServer } from 'ws'

// --- 新增：定义和管理UDP端口池 ---
const UDP_PORT_START = 40000
const UDP_PORT_END = 40100 // 我们只用101个端口，足够同时支持101个NAT检测
const usedUdpPorts = new Set()

// eslint-disable-next-line no-console
console.log(`Configured UDP port range for NAT tests: ${UDP_PORT_START}-${UDP_PORT_END}`)

function getFreeUdpPort() {
  for (let port = UDP_PORT_START; port <= UDP_PORT_END; port++) {
    if (!usedUdpPorts.has(port)) {
      usedUdpPorts.add(port)
      return port
    }
  }
  return null // 返回 null 表示端口池已满
}

function releaseUdpPort(port) {
  if (port) {
    usedUdpPorts.delete(port)
  }
}

// --- 假设你的服务器有一个可从公网访问的IP地址 ---
// 在生产环境中，你应该从环境变量或配置文件中读取
// 如果你的服务器在NAT后面，你需要配置端口转发，并在这里填写真实的公网IP
const SERVER_PUBLIC_IP = env.SERVER_PUBLIC_IP || '127.0.0.1'
// eslint-disable-next-line no-console
console.log(`Server public IP for NAT tests is configured as: ${SERVER_PUBLIC_IP}`)

const PORT = env.PORT || 8080
const HEARTBEAT_INTERVAL = 30000 // 30秒
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
const clientsByWs = new Map() // 重命名 clients 为 clientsByWs 以明确其键
const clientsById = new Map() // 新增 Map，用于通过 ID 查找
// --- 新增: 用于管理NAT检测会话 ---
const natTests = new Map() // key: clientId, value: { probeSocket, detectedPort, timer }

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

  clientsByWs.set(ws, clientWrapper)
  clientsById.set(clientId, clientWrapper) // 同时存入新的 Map

  // eslint-disable-next-line no-console
  console.log(`Client ${clientId} (${clientWrapper.name}) connected. Total clients: ${clientsByWs.size}`)

  clientWrapper.isAlive = true // 为每个客户端增加一个存活标记
  ws.on('pong', () => {
    // eslint-disable-next-line no-console
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
      // --- 新增: NAT检测流程的消息处理 ---
      case 'request_nat_detection': {
        // 如果此客户端已有测试在进行，先清理掉
        if (natTests.has(currentClient.id)) {
          const oldTest = natTests.get(currentClient.id)
          clearTimeout(oldTest.timer)
          oldTest.probeSocket.close()
          natTests.delete(currentClient.id)
        }
        // ---【核心修改】---
        const probePort = getFreeUdpPort()

        if (!probePort) {
          console.warn(`No available UDP ports for NAT test for client ${currentClient.id}. Port pool is full.`)
          ws.send(JSON.stringify({ type: 'error', payload: 'Server is busy, no available ports for NAT test. Please try again later.' }))
          return
        }

        const probeSocket = dgram.createSocket('udp4')

        // 新增：在socket关闭时，确保释放端口
        probeSocket.on('close', () => {
          releaseUdpPort(probePort)
          // eslint-disable-next-line no-console
          console.log(`Released UDP port ${probePort} for client ${currentClient.id}`)
        })

        const testInfo = {
          probeSocket,
          detectedPort: null,
          timer: setTimeout(() => {
            // eslint-disable-next-line no-console
            console.log(`NAT test for ${currentClient.id} on port ${probePort} timed out.`)
            probeSocket.close() // 这会触发上面的 'close' 事件来释放端口
            natTests.delete(currentClient.id)
          }, 20000),
        }
        natTests.set(currentClient.id, testInfo)

        probeSocket.on('error', (err) => {
          console.error(`NAT probe socket error for ${currentClient.id} on port ${probePort}:\n${err.stack}`)
          probeSocket.close() // 触发 'close'
          natTests.delete(currentClient.id)
        })

        // 核心：当收到客户端发来的UDP包时
        probeSocket.on('message', (msg, rinfo) => {
          // eslint-disable-next-line no-console
          console.log(`Received UDP probe from ${currentClient.id} at ${rinfo.address}:${rinfo.port}`)
          // 记录下服务器实际看到的客户端源端口
          testInfo.detectedPort = rinfo.port
          // 可以选择在这里就回复一个UDP包，虽然对于检测不是必须的
          probeSocket.send('ack', rinfo.port, rinfo.address)
        })

        // ---【核心修改】---
        // 不再使用 bind(0)，而是绑定我们自己分配的端口
        probeSocket.bind(probePort, () => {
          // eslint-disable-next-line no-console
          console.log(`NAT probe server for ${currentClient.id} listening on port ${probePort}`)
          ws.send(JSON.stringify({
            type: 'nat_probe_info',
            payload: {
              ip: SERVER_PUBLIC_IP,
              port: probePort, // 使用我们分配的端口
            },
          }))
        })
        break
      }

      case 'report_stun_mapping': {
        const testInfo = natTests.get(currentClient.id)
        const reportedPort = message.payload?.port

        if (!testInfo || !reportedPort) {
          ws.send(JSON.stringify({ type: 'error', payload: 'NAT test not initiated or invalid report.' }))
          return
        }

        // 等待一小段时间，确保UDP包可能已经到达
        setTimeout(() => {
          const { detectedPort, probeSocket, timer } = testInfo
          clearTimeout(timer) // 清除超时定时器
          probeSocket.close() // 关闭UDP socket
          natTests.delete(currentClient.id) // 从Map中移除测试

          let natType = 'Unknown'
          if (detectedPort) {
            if (detectedPort === reportedPort) {
              natType = 'Cone' // 端口相同，是锥形
            }
            else {
              natType = 'Symmetric' // 端口不同，是对称型
            }
          }
          else {
            natType = 'UDP Blocked or Symmetric' // 没收到包，可能是UDP被阻止或对称型（无法建立映射）
          }

          // eslint-disable-next-line no-console
          console.log(`NAT Test Result for ${currentClient.id}: Reported Port (from STUN) = ${reportedPort}, Detected Port (at server) = ${detectedPort || 'N/A'}. Conclusion: ${natType}`)

          // 将结果发回给客户端
          ws.send(JSON.stringify({
            type: 'nat_detection_result',
            payload: { natType },
          }))

          // 同时更新服务器上的客户端状态并广播给房间其他人
          currentClient.natType = natType
          if (currentClient.roomId) {
            broadcastToRoom(currentClient.roomId, {
              type: 'nat_type_info',
              payload: { id: currentClient.id, natType },
            })
          }
        }, 500) // 延迟500ms确保UDP包有时间到达
        break
      }
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
          natType: client.natType, // <--- 新增
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
            id: currentClient.id,
            name: currentClient.name,
            avatar: currentClient.avatar,
            natType: currentClient.natType, // <--- 新增
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
      case 'share_nat_type': {
        if (!currentClient.roomId || !message.payload?.natType)
          return

        // 1. 更新服务器上该客户端的状态
        currentClient.natType = message.payload.natType
        // eslint-disable-next-line no-console
        console.log(`Updated NAT type for ${currentClient.id} to ${currentClient.natType}`)

        // 2. 广播这个更新给房间内其他人
        broadcastToRoom(currentClient.roomId, {
          type: 'nat_type_info', // 重用这个消息类型
          payload: {
            id: currentClient.id,
            natType: currentClient.natType,
          },
        })
        break
      }
      default:
        // eslint-disable-next-line no-console
        console.log(`Unknown message type from ${currentClient.id}: ${message.type}`)
        ws.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${message.type}` }))
    }
  })

  ws.on('close', () => {
    // --- 新增: 清理该客户端可能存在的NAT测试 ---
    const closingClient = clientsByWs.get(ws)
    if (closingClient && natTests.has(closingClient.id)) {
      const test = natTests.get(closingClient.id)
      clearTimeout(test.timer)
      test.probeSocket.close()
      natTests.delete(closingClient.id)
      // eslint-disable-next-line no-console
      console.log(`Cleaned up NAT test for disconnected client ${closingClient.id}`)
    }
    if (!closingClient)
      return

    clientsByWs.delete(ws)
    clientsById.delete(closingClient.id) // 从 ID Map 中也删除
    // eslint-disable-next-line no-console
    console.log(`Client ${closingClient.id} (${closingClient.name}) disconnected. Total clients: ${clientsByWs.size}`)

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
    const errorClient = clientsByWs.get(ws)
    console.error(`WebSocket error for client ${errorClient?.id || 'unknown'}:`, error)
    // 可以在这里尝试清理该客户端的连接和房间信息，类似 'close' 事件处理
  })
})
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = clientsByWs.get(ws)
    if (!client || client.isAlive === false) {
      console.warn(`Terminating dead connection for client ${client?.id || 'unknown'}`)
      return ws.terminate()
    }

    client.isAlive = false // 假设它已经死了，等待 pong 来反证
    ws.ping(() => {
      // eslint-disable-next-line no-console
      console.log(`Ping sent to ${client.id}`)
    })
  })
}, HEARTBEAT_INTERVAL)
// 确保服务器关闭时清理定时器
wss.on('close', () => {
  clearInterval(interval)
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
