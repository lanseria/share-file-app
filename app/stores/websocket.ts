// stores/websocket.ts

import { defineStore } from 'pinia'

// --- 2. Pinia Store 定义 ---
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

  function onMessage(handler: (msg: any) => void) {
    messageHandlers.add(handler)
    return () => messageHandlers.delete(handler)
  }

  onUnmounted(() => {
    disconnect()
  })

  // --- 4. 导出新的 action ---
  return {
    ws,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    onMessage,
  }
})
