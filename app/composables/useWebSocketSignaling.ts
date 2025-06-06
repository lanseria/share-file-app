// app/composables/useWebSocketSignaling.ts
// 定义接口，与之前一致
export interface User {
  id: string
  name: string
  avatar: string
}

export interface MessageLog {
  type: 'received' | 'sent' | 'local_info' | 'error' | 'local_error'
  data?: any
  text?: string
}

const SIGNALING_SERVER_URL = 'ws://localhost:8080'

// Composable 函数
export function useWebSocketSignaling(roomId: string) {
  // 内部状态
  const ws = ref<WebSocket | null>(null)

  // 对外暴露的响应式状态
  const messages = ref<MessageLog[]>([])
  const usersInRoom = ref<User[]>([])
  const myClientId = ref<string | null>(null)
  const myName = ref<string | null>(null)
  const myAvatar = ref<string | null>(null)
  const isConnected = ref(false)

  // 内部函数，处理 WebSocket 消息
  function handleSocketMessage(event: MessageEvent) {
    try {
      const messageData = JSON.parse(event.data as string)
      // eslint-disable-next-line no-console
      console.log('从服务器收到消息:', messageData)
      messages.value.push({ type: 'received', data: messageData })

      switch (messageData.type) {
        case 'room_joined':
          myClientId.value = messageData.payload?.clientId
          myName.value = messageData.payload?.name
          myAvatar.value = messageData.payload?.avatar
          if (myClientId.value && myName.value && myAvatar.value) {
            const selfUser = { id: myClientId.value, name: myName.value, avatar: myAvatar.value }
            if (!usersInRoom.value.find(u => u.id === selfUser.id)) {
              usersInRoom.value.push(selfUser)
            }
          }
          break
        case 'existing_users': {
          const existingUsers = messageData.payload?.users as User[]
          if (existingUsers) {
            existingUsers.forEach((newUser) => {
              if (!usersInRoom.value.find(u => u.id === newUser.id)) {
                usersInRoom.value.push(newUser)
              }
            })
          }
          break
        }
        case 'user_joined':{
          const joinedUserPayload = messageData.payload
          if (joinedUserPayload && joinedUserPayload.id && joinedUserPayload.name && joinedUserPayload.avatar) {
            const userToAdd: User = { id: joinedUserPayload.id, name: joinedUserPayload.name, avatar: joinedUserPayload.avatar }
            if (userToAdd.id !== myClientId.value && !usersInRoom.value.find(u => u.id === userToAdd.id)) {
              usersInRoom.value.push(userToAdd)
            }
          }
          break
        }
        case 'user_left':{
          const leftUserId = messageData.payload?.id
          if (leftUserId) {
            usersInRoom.value = usersInRoom.value.filter(user => user.id !== leftUserId)
          }
          break
        }
        case 'room_message':{
          // 可以在这里进一步处理，例如通过回调或事件总线通知外部
          break
        }
      }
    }
    catch (e) {
      console.error('解析服务器消息失败:', event.data, e)
      messages.value.push({ type: 'error', text: `解析服务器消息失败: ${event.data}` })
    }
  }

  // 对外暴露的方法
  function connect() {
    if (!roomId || typeof roomId !== 'string') {
      console.error('房间 ID 无效，无法连接 WebSocket')
      messages.value.push({ type: 'local_error', text: '房间 ID 无效' })
      return
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.warn('WebSocket 已连接.')
      return
    }

    messages.value.push({ type: 'local_info', text: `正在连接到 ${SIGNALING_SERVER_URL}...` })
    const socket = new WebSocket(SIGNALING_SERVER_URL)

    socket.onopen = () => {
      messages.value.push({ type: 'local_info', text: '已连接到信令服务器!' })
      isConnected.value = true
      ws.value = socket

      const joinMessage = { type: 'join_room', payload: { roomId } }
      socket.send(JSON.stringify(joinMessage))
      messages.value.push({ type: 'sent', text: `发送加入房间请求: ${roomId}` })
    }

    socket.onmessage = handleSocketMessage

    socket.onerror = (error) => {
      console.error('WebSocket 错误:', error)
      messages.value.push({ type: 'error', text: `WebSocket 错误` })
    }

    socket.onclose = (event) => {
      messages.value.push({ type: 'local_info', text: `与信令服务器的连接已关闭. Code: ${event.code}` })
      isConnected.value = false
      ws.value = null
      myClientId.value = null
      myName.value = null
      myAvatar.value = null
      usersInRoom.value = []
    }
  }

  function sendMessage<T>(type: string, payload: T) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      const message = { type, payload }
      ws.value.send(JSON.stringify(message))
      messages.value.push({ type: 'sent', text: `发送 ${type} 消息`, data: payload })
      return true
    }
    else {
      messages.value.push({ type: 'local_error', text: 'WebSocket 未连接，消息发送失败' })
      return false
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
    }
  }

  // 确保在组件卸载时自动断开连接
  onUnmounted(() => {
    disconnect()
  })

  // 返回需要暴露给组件的状态和方法
  return {
    // 响应式状态 (使用 readonly 防止外部直接修改，推荐)
    messages,
    usersInRoom,
    myClientId,
    myName,
    myAvatar,
    isConnected,

    // 方法
    connect,
    disconnect,
    sendMessage,
  }
}
