// app/composables/useWebRtcManager.ts

// 定义信令发送函数的类型签名
export type SignalingSender = <T>(type: string, payload: T) => void

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function useWebRtcManager(signalingSender: SignalingSender) {
  const peerConnections = new Map<string, RTCPeerConnection>()
  // 新增: 使用 reactive Map 来存储每个 peer 的连接状态，使其具有响应性
  const peerConnectionStates = reactive<Map<string, RTCIceConnectionState>>(new Map())

  function getOrCreatePeerConnection(peerId: string): RTCPeerConnection {
    let pc = peerConnections.get(peerId)
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      // 初始化状态
      peerConnectionStates.set(peerId, pc.iceConnectionState)

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signalingSender('candidate', {
            targetId: peerId,
            candidate: event.candidate,
          })
        }
      }

      pc.oniceconnectionstatechange = () => {
        const newState = pc?.iceConnectionState
        // eslint-disable-next-line no-console
        console.log(`ICE connection state with ${peerId} changed to: ${newState}`)
        if (newState) {
          // 更新响应式状态
          peerConnectionStates.set(peerId, newState)
        }
        if (pc?.iceConnectionState === 'failed' || pc?.iceConnectionState === 'disconnected' || pc?.iceConnectionState === 'closed') {
          // 清理
          closePeerConnection(peerId)
        }
      }

      pc.ondatachannel = (event) => {
        const receiveChannel = event.channel
        // eslint-disable-next-line no-console
        console.log(`Received data channel "${receiveChannel.label}" from ${peerId}`)
        // TODO: 处理接收到的 DataChannel
      }

      peerConnections.set(peerId, pc)
    }
    return pc
  }

  async function initiatePeerConnection(peerId: string) {
    const pc = getOrCreatePeerConnection(peerId)

    // 创建数据通道
    pc.createDataChannel('fileTransfer')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    signalingSender('offer', {
      targetId: peerId,
      offer,
    })
  }

  async function handleRtcMessage(message: any) {
    const peerId = message.payload.senderId
    if (!peerId)
      return

    const pc = getOrCreatePeerConnection(peerId)

    switch (message.type) {
      case 'offer':{
        await pc.setRemoteDescription(new RTCSessionDescription(message.payload.offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        signalingSender('answer', { targetId: peerId, answer })
        break
      }

      case 'answer':{
        await pc.setRemoteDescription(new RTCSessionDescription(message.payload.answer))
        break
      }

      case 'candidate':{
        if (message.payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(message.payload.candidate))
          }
          catch (e) {
            console.error('Error adding received ice candidate', e)
          }
        }
        break
      }
    }
  }

  function closePeerConnection(peerId: string) {
    const pc = peerConnections.get(peerId)
    if (pc) {
      pc.close()
      peerConnections.delete(peerId)
      // 清理状态
      peerConnectionStates.delete(peerId)
      // eslint-disable-next-line no-console
      console.log(`Closed and removed PeerConnection with ${peerId}`)
    }
  }

  function closeAllPeerConnections() {
    for (const peerId of peerConnections.keys()) {
      closePeerConnection(peerId)
    }
  }

  onUnmounted(() => {
    closeAllPeerConnections()
  })

  return {
    peerConnectionStates,
    initiatePeerConnection,
    handleRtcMessage,
    closePeerConnection,
    closeAllPeerConnections,
  }
}
