// stores/websocket.ts

import { defineStore } from 'pinia'

// NatTypeResult 类型现在可以更精确了
export type NatTypeResult =
  | 'Full Cone'
  | 'Restricted Cone'
  | 'Port-Restricted Cone'
  | 'Symmetric'
  | 'UDP Blocked'
  | 'Unknown'
  | 'Cone (subtype undetermined)' // 新增一个备用状态

function getStunMapping(): Promise<{ address: string, port: number } | null> {
  return new Promise((resolve, reject) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:74.125.250.129:19302' }],
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
// --- 【新增】用于Test III的辅助函数 ---
// 这个函数会创建一个数据通道，并监听它是否收到特定消息
function setupTestIIIListener(
  reportResult: (received: boolean) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection()
  const testChannel = pc.createDataChannel('test-iii-listener')
  let receivedTestIIIPacket = false

  testChannel.onmessage = (event) => {
    if (event.data === 'test_port_restriction') {
      console.log('Received Test III packet from server!')
      receivedTestIIIPacket = true
      // 收到包后立即报告，并关闭连接
      reportResult(true)
      pc.close()
    }
  }

  // 设置一个定时器，如果在一定时间内没收到包，就报告失败
  const testIIITimeout = setTimeout(() => {
    if (!receivedTestIIIPacket) {
      console.log('Test III packet did not arrive in time.')
      reportResult(false)
      pc.close()
    }
  }, 3000) // 等待3秒

  // 确保连接关闭时清除定时器
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      clearTimeout(testIIITimeout)
    }
  }

  // 必须创建offer来启动ICE，但我们不需要发送它
  pc.createOffer().then(offer => pc.setLocalDescription(offer))

  return pc
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
  async function detectNatType(): Promise<NatTypeResult> {
  // 检查 WebSocket 连接状态
    if (!isConnected.value || !ws.value) {
      throw new Error('WebSocket is not connected.')
    }

    // --- 为 Test III 设置监听器 ---
    let testIIIPC: RTCPeerConnection | null = null
    const reportTestIII = (received: boolean) => {
    // 确保只报告一次，并使用 store 的 sendMessage
      if (testIIIPC && testIIIPC.connectionState !== 'closed') {
        sendMessage('report_test_III_result', { received })
        testIIIPC.close()
        testIIIPC = null // 清理引用
      }
    }
    testIIIPC = setupTestIIIListener(reportTestIII)

    console.log('Requesting NAT detection from server...')
    // 使用 store 的 sendMessage 发送请求
    sendMessage('request_nat_detection', {})

    return new Promise((resolve, reject) => {
    // 定义消息处理器
      const handleMessage = (message: any) => {
        if (message.type === 'nat_probe_info') {
        // 这个异步流程保持不变
          (async () => {
            try {
              const stunMapping = await getStunMapping()
              if (!stunMapping)
                throw new Error('Could not get mapping from public STUN server.')

              await sendUdpProbe(message.payload.ip, message.payload.port)

              // 使用 store 的 sendMessage 报告 STUN 结果
              sendMessage('report_stun_mapping', { port: stunMapping.port })
            }
            catch (error) {
              cleanupAndReject(error as Error)
            }
          })()
        }
        else if (message.type === 'nat_detection_result') {
          // 收到最终结果
          cleanupAndResolve(message.payload.natType)
        }
        else if (message.type === 'error' && message.payload?.includes('NAT test')) {
        // 收到服务器关于NAT测试的错误
          cleanupAndReject(new Error(message.payload))
        }
      }

      // 使用 store 的 onMessage 来注册处理器
      const removeHandler = onMessage(handleMessage)

      // 设置整个流程的超时
      const timeoutId = setTimeout(() => {
        cleanupAndReject(new Error('NAT detection timed out.'))
      }, 25000)

      // 统一的清理和回调函数
      function cleanup() {
        clearTimeout(timeoutId)
        removeHandler() // 从 onMessage 中移除处理器
        if (testIIIPC) {
          testIIIPC.close()
          testIIIPC = null
        }
      }

      function cleanupAndResolve(value: NatTypeResult) {
        cleanup()
        resolve(value)
      }

      function cleanupAndReject(reason: Error) {
        cleanup()
        reject(reason)
      }
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
