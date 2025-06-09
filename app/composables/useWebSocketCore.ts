// app/composables/useWebSocketCore.ts

// 定义一个事件处理器接口，让调用者可以注入自己的消息处理逻辑
export interface MessageHandler {
  (message: any): void
}

export function useWebSocketCore() {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)

  // 存储外部注入的消息处理器
  let messageHandler: MessageHandler | null = null

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.warn('WebSocket is already connected.')
      return
    }

    const wsUrl = getSignalingServerUrl()
    const socket = new WebSocket(wsUrl)
    ws.value = socket

    socket.onopen = () => {
      // eslint-disable-next-line no-console
      console.log('WebSocket connection established.')
      isConnected.value = true
    }

    socket.onmessage = (event: MessageEvent) => {
      try {
        const messageData = JSON.parse(event.data as string)
        // 如果有处理器，就调用它
        if (messageHandler) {
          messageHandler(messageData)
        }
      }
      catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      isConnected.value = false // 通常错误后会触发 close
    }

    socket.onclose = () => {
      // eslint-disable-next-line no-console
      console.log('WebSocket connection closed.')
      isConnected.value = false
      ws.value = null
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close()
    }
  }

  function sendMessage<T>(type: string, payload: T) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      const message = { type, payload }
      ws.value.send(JSON.stringify(message))
      return true
    }
    else {
      console.error('WebSocket is not connected. Cannot send message.')
      return false
    }
  }

  // 允许外部设置消息处理器
  function onMessage(handler: MessageHandler) {
    messageHandler = handler
  }

  // 自动清理
  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected: readonly(isConnected),
    connect,
    disconnect,
    sendMessage,
    onMessage,
  }
}
