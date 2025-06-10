/* eslint-disable no-console */
// stores/websocket.ts

import { defineStore } from 'pinia'

// 定义更具描述性的结果类型
export interface ConnectivityResult {
  testSuccess: boolean
  message: string
  localCandidateType?: string
  remoteCandidateType?: string
  p2pConnected: boolean
}

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
  /**
   * Performs a WebRTC connectivity test with the server.
   * The server acts as a peer to establish a connection.
   * The result indicates whether a P2P-like connection can be established.
   */
  async function testConnectivity(): Promise<ConnectivityResult> {
    if (!isConnected.value || !ws.value) {
      throw new Error('WebSocket is not connected.')
    }

    return new Promise((resolve, reject) => {
      let pc: RTCPeerConnection | null = new RTCPeerConnection({
        iceServers: [
          // 使用公共 STUN 服务器来帮助客户端发现自己的公网映射
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      const dc = pc.createDataChannel('connectivity-test')
      let testFinished = false

      // 5. 设置超时
      const timeoutId = setTimeout(() => {
        cleanupAndResolve({ testSuccess: false, message: 'Connectivity test timed out. UDP is likely blocked or severely restricted.', p2pConnected: false })
      }, 15000) // 15秒超时
      const removeHandler = onMessage(handleMessage)
      function cleanupAndResolve(result: ConnectivityResult) {
        if (testFinished)
          return
        testFinished = true

        clearTimeout(timeoutId)
        removeHandler()
        if (pc) {
          pc.close()
          pc = null
        }
        resolve(result)
      }

      const cleanupAndReject = (error: Error) => {
        if (testFinished)
          return
        testFinished = true

        clearTimeout(timeoutId)
        removeHandler()
        if (pc) {
          pc.close()
          pc = null
        }
        reject(error)
      }

      // 1. 监听 ICE candidate 并通过 WebSocket 发送
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendMessage('webrtc_test_candidate', { candidate: event.candidate.toJSON() })
        }
      }

      // 2. 监听连接状态变化，这是判断结果的关键
      pc.oniceconnectionstatechange = async () => {
        if (!pc)
          return

        console.log(`ICE Connection State: ${pc.iceConnectionState}`)

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          // 连接成功！现在分析连接类型
          try {
            const stats = await pc.getStats()
            let selectedPair: any
            stats.forEach((report) => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                selectedPair = report
              }
            })

            if (selectedPair) {
              const localCand = stats.get(selectedPair.localCandidateId)
              const remoteCand = stats.get(selectedPair.remoteCandidateId)

              const result: ConnectivityResult = {
                testSuccess: true,
                message: `Successfully connected! Local: ${localCand.candidateType}, Remote: ${remoteCand.candidateType}`,
                localCandidateType: localCand.candidateType, // 'host', 'srflx', 'prflx', 'relay'
                remoteCandidateType: remoteCand.candidateType, // 'host', 'srflx', 'prflx', 'relay'
                p2pConnected: remoteCand.candidateType !== 'relay', // 如果远端不是中继，通常认为是P2P
              }
              cleanupAndResolve(result)
            }
            else {
              // 理论上 'connected' 状态应该能找到成功的 pair, 这是备用情况
              cleanupAndResolve({ testSuccess: true, message: 'Connected, but failed to get stats.', p2pConnected: true })
            }
          }
          // eslint-disable-next-line unused-imports/no-unused-vars
          catch (error) {
            cleanupAndReject(new Error('Failed to get connection stats.'))
          }
        }
        else if (pc.iceConnectionState === 'failed') {
          cleanupAndResolve({ testSuccess: false, message: 'WebRTC connection failed. UDP might be blocked or NAT is too restrictive.', p2pConnected: false })
        }
      }

      // 3. 监听WebSocket消息，接收服务器的answer和candidate
      function handleMessage(message: any) {
        if (!pc)
          return

        if (message.type === 'webrtc_test_answer') {
          pc.setRemoteDescription(new RTCSessionDescription(message.payload.answer))
            .catch(cleanupAndReject)
        }
        else if (message.type === 'webrtc_test_candidate') {
          pc.addIceCandidate(new RTCIceCandidate(message.payload))
            .catch(e => console.warn('Error adding ICE candidate', e))
        }
        else if (message.type === 'error' && message.payload?.includes('WebRTC')) {
          cleanupAndReject(new Error(message.payload))
        }
      }

      // 4. 创建并发送 offer
      pc.createOffer()
        .then(offer => pc!.setLocalDescription(offer))
        .then(() => {
          sendMessage('request_webrtc_test_offer', { offer: pc!.localDescription!.toJSON() })
        })
        .catch(cleanupAndReject)
    })
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
    testConnectivity, // <-- 导出 NAT 检测方法
  }
})
