// stores/websocket.ts
export const useWebSocketStore = defineStore('websocket', () => {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const config = useRuntimeConfig()

  const messageHandlers: Set<(msg: any) => void> = new Set()

  function connect() {
    if (ws.value && ws.value.readyState === WebSocket.OPEN)
      return

    const socket = new WebSocket(config.public.signalingServerUrl)
    ws.value = socket

    socket.onopen = () => { isConnected.value = true }
    socket.onclose = () => { isConnected.value = false; ws.value = null }
    socket.onerror = () => { isConnected.value = false }
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        messageHandlers.forEach(handler => handler(data))
      }
      catch (e) { console.error(e) }
    }
  }

  function disconnect() {
    ws.value?.close()
  }

  function sendMessage<T>(type: string, payload: T) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ type, payload }))
      return true
    }
    return false
  }

  // 允许多个 Composable 监听消息
  function onMessage(handler: (msg: any) => void) {
    messageHandlers.add(handler)
    // 返回一个取消监听的函数
    return () => messageHandlers.delete(handler)
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    onMessage,
  }
})
