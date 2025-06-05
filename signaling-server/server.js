// signaling-server/server.js
import { WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

const PORT = process.env.PORT || 8080 // 信令服务器端口

// 使用 WebSocketServer 创建一个 WebSocket 服务器实例
const wss = new WebSocketServer({ port: PORT })

// 用于存储房间和客户端连接信息
// 结构:
// rooms = {
//   "roomId1": Set<WebSocketClientWrapper>,
//   "roomId2": Set<WebSocketClientWrapper>,
//   ...
// }
// WebSocketClientWrapper = { ws: WebSocket, id: string, roomId: string | null }
const rooms = new Map()
const clients = new Map() // 用于通过 ws 对象快速查找 clientWrapper

console.log(`Signaling server started on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  // 为每个连接生成一个唯一的客户端 ID
  const clientId = uuidv4()
  const clientWrapper = { ws, id: clientId, roomId: null }
  clients.set(ws, clientWrapper)

  console.log(`Client ${clientId} connected. Total clients: ${clients.size}`)

  ws.on('message', (messageText) => {
    let message
    try {
      message = JSON.parse(messageText.toString()) // 确保将 Buffer 转为字符串
    }
    catch (e) {
      console.error(`Failed to parse message from ${clientId}:`, messageText.toString())
      ws.send(JSON.stringify({ type: 'error', payload: 'Invalid JSON message' }))
      return
    }

    const currentClient = clients.get(ws)
    if (!currentClient) return // 应该不会发生

    console.log(`Received message from ${currentClient.id} in room ${currentClient.roomId || 'N/A'}:`, message)

    switch (message.type) {
      case 'join_room': {
        const roomId = message.payload?.roomId
        if (!roomId || typeof roomId !== 'string') {
          ws.send(JSON.stringify({ type: 'error', payload: 'Invalid roomId for join_room' }))
          return
        }

        // 如果客户端已在其他房间，先离开
        if (currentClient.roomId && rooms.has(currentClient.roomId)) {
          rooms.get(currentClient.roomId)?.delete(currentClient)
          if (rooms.get(currentClient.roomId)?.size === 0) {
            rooms.delete(currentClient.roomId)
            console.log(`Room ${currentClient.roomId} is now empty and removed.`)
          }
        }

        currentClient.roomId = roomId
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set())
        }
        rooms.get(roomId)?.add(currentClient)

        console.log(`Client ${currentClient.id} joined room ${roomId}. Room size: ${rooms.get(roomId)?.size}`)
        ws.send(JSON.stringify({ type: 'room_joined', payload: { roomId, clientId: currentClient.id } }))

        // 通知房间内其他用户有新人加入 (可选，后续会用到)
        broadcastToRoom(roomId, {
          type: 'user_joined',
          payload: { userId: currentClient.id, /* 更多用户信息 */ },
        }, currentClient.id) // 不发给自己
        break
      }

      // 简单的消息转发逻辑 (后续会扩展为 SDP, ICE Candidate 等)
      // 期望消息格式: { type: "message_to_room", payload: { roomId: "...", data: "..." } }
      // 或者 { type: "direct_message", payload: { targetId: "...", data: "..." } }
      // 目前先做一个简单的房间内广播
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
          payload: { senderId: currentClient.id, data: message.payload.data },
        }, currentClient.id) // 不发给自己
        break
      }

      // 后续会在这里添加处理 SDP Offer/Answer 和 ICE Candidate 的 case
      // case 'offer':
      // case 'answer':
      // case 'candidate':
      //   // ... 转发逻辑
      //   break;

      default:
        console.log(`Unknown message type from ${currentClient.id}: ${message.type}`)
        ws.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${message.type}` }))
    }
  })

  ws.on('close', () => {
    const closingClient = clients.get(ws)
    if (!closingClient) return

    clients.delete(ws)
    console.log(`Client ${closingClient.id} disconnected. Total clients: ${clients.size}`)

    if (closingClient.roomId && rooms.has(closingClient.roomId)) {
      const room = rooms.get(closingClient.roomId)
      room?.delete(closingClient)
      console.log(`Client ${closingClient.id} removed from room ${closingClient.roomId}. Room size: ${room?.size}`)

      if (room?.size === 0) {
        rooms.delete(closingClient.roomId)
        console.log(`Room ${closingClient.roomId} is now empty and removed.`)
      } else {
        // 通知房间内其他用户有人离开 (可选，后续会用到)
        broadcastToRoom(closingClient.roomId, {
          type: 'user_left',
          payload: { userId: closingClient.id },
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
        } catch (e) {
          console.error(`Failed to send message to client ${client.id} in room ${roomId}:`, e)
          // 可以在这里处理发送失败的客户端，比如将其从房间移除
        }
      }
    })
  }
}