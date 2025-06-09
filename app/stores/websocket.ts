// stores/websocket.ts

import { defineStore } from 'pinia'

// --- 1. 将 useServerNatDetector 的所有辅助函数和类型直接移到这里 ---
export type NatTypeResult = 'Cone' | 'Symmetric' | 'UDP Blocked or Symmetric' | 'Unknown'

function getStunMapping(): Promise<{ address: string, port: number } | null> {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const timeoutId = setTimeout(() => { pc.close(); reject(new Error('STUN mapping timeout')) }, 5000)
    pc.onicecandidate = (e) => {
      if (e.candidate && e.candidate.type === 'srflx') {
        clearTimeout(timeoutId)
        pc.close()
        resolve({ address: e.candidate.address!, port: e.candidate.port! })
      }
    }
    pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timeoutId); pc.close(); resolve(null) } }
    pc.onicecandidateerror = (e) => { clearTimeout(timeoutId); pc.close(); reject(e) }
    try { pc.addTransceiver('audio', { direction: 'inactive' }) }
    catch (e) { /* old browsers */ }
    pc.createDataChannel('nat-test')
    pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(reject)
  })
}

function sendUdpProbe(ip: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection()
    const timeoutId = setTimeout(() => { pc.close(); reject(new Error('UDP probe timeout')) }, 5000)

    pc.onicecandidate = (e) => {
      if (!e.candidate) { clearTimeout(timeoutId); pc.close(); setTimeout(resolve, 100) }
    }

    pc.createDataChannel('probe')

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        const localSdp = pc.localDescription?.sdp
        if (!localSdp)
          throw new Error('Local SDP is not available.')

        const fingerprintLine = localSdp.split('\r\n').find(line => line.startsWith('a=fingerprint:'))
        if (!fingerprintLine)
          throw new Error('DTLS fingerprint not found in local SDP.')

        const remoteSdp = `${[
          'v=0',
          `o=- ${Date.now()} ${Date.now()} IN IP4 127.0.0.1`,
          's=-',
          't=0 0',
          `m=application ${port} UDP/DTLS/SCTP webrtc-datachannel`,
          `c=IN IP4 ${ip}`,
          'a=mid:0',
          'a=sctp-port:5000',
          fingerprintLine,
          'a=ice-ufrag:dummyufraglongenough',
          'a=ice-pwd:dummypasswordlongenoughtobevalid',
          // --- 关键改动在这里 ---
          'a=setup:active', // <-- 将 actpass 改为 active
          'a=sendrecv',
        ].join('\r\n')}\r\n`

        console.log('Constructed Remote SDP for probe (v4 - final):', remoteSdp)

        return pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp })
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        pc.close()
        reject(err)
      })
  })
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

  // --- 3. 将 `detect` 逻辑直接作为 store 的一个 action ---
  async function detectNatType(): Promise<NatTypeResult> {
    // 关键检查：确保在执行前 WebSocket 已连接
    if (!isConnected.value)
      throw new Error('WebSocket is not connected. Please wait for the connection to establish.')

    const webSocket = ws.value! // 此时 ws.value 肯定不为 null

    console.log('Requesting NAT detection from server...')
    webSocket.send(JSON.stringify({ type: 'request_nat_detection' }))

    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        const message = JSON.parse(event.data)
        if (message.type === 'nat_probe_info') {
          try {
            const stunMapping = await getStunMapping()
            if (!stunMapping)
              throw new Error('Could not get mapping from public STUN server.')

            await sendUdpProbe(message.payload.ip, message.payload.port)

            webSocket.send(JSON.stringify({ type: 'report_stun_mapping', payload: { port: stunMapping.port } }))
          }
          catch (error) {
            webSocket.removeEventListener('message', handleMessage)
            reject(error)
          }
        }
        else if (message.type === 'nat_detection_result') {
          webSocket.removeEventListener('message', handleMessage)
          resolve(message.payload.natType)
        }
        else if (message.type === 'error' && message.payload.startsWith('NAT test')) {
          webSocket.removeEventListener('message', handleMessage)
          reject(new Error(message.payload))
        }
      }
      webSocket.addEventListener('message', handleMessage)

      const timeoutId = setTimeout(() => {
        webSocket.removeEventListener('message', handleMessage)
        reject(new Error('NAT detection timed out.'))
      }, 25000)

      const cleanup = () => clearTimeout(timeoutId)
      const originalResolve = resolve
      const originalReject = reject
      resolve = (value) => { cleanup(); originalResolve(value) }
      reject = (reason) => { cleanup(); originalReject(reason) }
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
    detectNatType, // <-- 导出 NAT 检测方法
  }
})
