// app/composables/useWebRtcManager.ts

// 定义信令发送函数的类型签名
export type SignalingSender = <T>(type: string, payload: T) => void
// 定义新的类型
export type IceCandidateHandler = (entry: any) => void // 使用 any 简化

export interface DataChannelEventHandler {
  onOpen: (peerId: string) => void
  onClose: (peerId: string) => void
  onMessage: (peerId: string, data: any) => void
}

export function useWebRtcManager(signalingSender: SignalingSender) {
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>() // 存储 data channels
  const peerConnectionStates = reactive<Map<string, RTCIceConnectionState>>(new Map())

  // 外部注入的事件处理器
  let dataChannelEventHandler: DataChannelEventHandler | null = null
  // 文件接收缓冲区: peerId -> { chunks[], metadata, receivedSize }
  let iceCandidateHandler: IceCandidateHandler | null = null // 新增
  let gatheringStartTime: number | null = null // 新增

  const fileReceiveBuffers = new Map<string, { chunks: ArrayBuffer[], metadata: any, receivedSize: number }>()
  function handleDataChannelMessage(peerId: string, data: any) {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data)
        if (message.isMetadata) {
          // eslint-disable-next-line no-console
          console.log(`[RTC] Received metadata from ${peerId}:`, message)
          fileReceiveBuffers.set(peerId, {
            chunks: [],
            metadata: message,
            receivedSize: 0,
          })
          // 通知上层开始接收
          dataChannelEventHandler?.onMessage(peerId, { type: 'start', payload: message })
        }
        else if (message.isTransferComplete) {
          // eslint-disable-next-line no-console
          console.log(`[RTC] Received transfer complete signal from ${peerId}`)
          const buffer = fileReceiveBuffers.get(peerId)
          if (buffer) {
            const fileBlob = new Blob(buffer.chunks, { type: buffer.metadata.type })
            // 通知上层文件已准备好
            dataChannelEventHandler?.onMessage(peerId, { type: 'end', payload: { blob: fileBlob, name: buffer.metadata.name } })
            fileReceiveBuffers.delete(peerId)
          }
        }
        else if (message.isProgress) {
          // 转发进度给上层
          dataChannelEventHandler?.onMessage(peerId, { type: 'progress', payload: message })
        }
      }
      catch (e) {
        console.error('[RTC] Error parsing message:', e)
      } // 不是 JSON 就忽略，当作文件块处理
    }
    else if (data instanceof ArrayBuffer) {
      const buffer = fileReceiveBuffers.get(peerId)
      if (buffer) {
        buffer.chunks.push(data)
        buffer.receivedSize += data.byteLength
        // 通知上层接收进度
        dataChannelEventHandler?.onMessage(peerId, { type: 'progress', payload: { receivedBytes: buffer.receivedSize, totalBytes: buffer.metadata.size } })
      }
    }
  }

  function getOrCreatePeerConnection(peerId: string, configuration: RTCConfiguration): RTCPeerConnection {
    let pc = peerConnections.get(peerId)
    if (!pc) {
      // 使用传入的动态配置
      pc = new RTCPeerConnection(configuration)
      peerConnectionStates.set(peerId, pc.iceConnectionState)
      gatheringStartTime = performance.now() // 重置计时器

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signalingSender('candidate', { targetId: peerId, candidate: event.candidate })
          // 报告候选者给上层
          const time = (performance.now() - (gatheringStartTime || 0)) / 1000
          iceCandidateHandler?.({
            time,
            type: event.candidate.type,
            foundation: event.candidate.foundation,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            priority: event.candidate.priority,
            url: event.candidate.candidate.split(' ').slice(-2)[0], // 简单的 URL 解析
          })
        }
      }

      pc.onicegatheringstatechange = () => {
        const newState = pc?.iceGatheringState
        if (newState === 'complete') {
          const time = (performance.now() - (gatheringStartTime || 0)) / 1000
          iceCandidateHandler?.({ type: 'done', time })
        }
      }

      // --- 【核心修复】 ---
      // 监听真正的 P2P 连接状态变化。这才是更新 UI 的正确事件。
      pc.oniceconnectionstatechange = () => {
        const state = pc?.iceConnectionState
        if (state) {
          // eslint-disable-next-line no-console
          console.log(`[RTC] ICE Connection state for ${peerId} changed: ${state}`)
          peerConnectionStates.set(peerId, state)
          if (state === 'failed' || state === 'disconnected' || state === 'closed') {
            closePeerConnection(peerId)
          }
        }
      }

      // 监听由远端对等体创建的数据通道。这是解决单向连接的关键！
      pc.ondatachannel = (event) => {
        // eslint-disable-next-line no-console
        console.log(`[RTC] Received data channel from ${peerId}`)
        const channel = event.channel
        setupDataChannel(peerId, channel) // 使用相同的设置函数
      }

      pc.onicecandidateerror = (event) => {
        const time = (performance.now() - (gatheringStartTime || 0)) / 1000
        iceCandidateHandler?.({
          type: 'error',
          time,
          errorText: `Code ${event.errorCode}: ${event.errorText}`,
        })
      }

      peerConnections.set(peerId, pc)
    }
    return pc
  }

  function setupDataChannel(peerId: string, channel: RTCDataChannel) {
    dataChannels.set(peerId, channel)

    channel.onopen = () => {
      // eslint-disable-next-line no-console
      console.log(`[RTC] DataChannel with ${peerId} is open.`)
      dataChannelEventHandler?.onOpen(peerId)
    }

    channel.onclose = () => {
      // eslint-disable-next-line no-console
      console.log(`[RTC] DataChannel with ${peerId} is closed.`)
      dataChannelEventHandler?.onClose(peerId)
    }

    channel.onmessage = event => handleDataChannelMessage(peerId, event.data)
  }

  // 将 initiatePeerConnection 重构为更明确的函数
  async function initiatePeerConnection(peerId: string, configuration: RTCConfiguration) {
    try {
      // eslint-disable-next-line no-console
      console.log(`[RTC] Manually initiating connection to ${peerId}`)
      const pc = getOrCreatePeerConnection(peerId, configuration)

      // 创建数据通道
      const channel = pc.createDataChannel('fileTransfer', { ordered: true })
      setupDataChannel(peerId, channel)

      // 直接创建并发送 offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      signalingSender('offer', { targetId: peerId, offer })
    }
    catch (e) {
      console.error(`[RTC] Error initiating connection to ${peerId}:`, e)
    }
  }

  function sendFile(peerId: string, file: File) {
    const dataChannel = dataChannels.get(peerId)
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error('[RTC] Data channel is not open for peer:', peerId)
      dataChannelEventHandler?.onClose(peerId) // 通知上层传输失败
      return
    }

    // eslint-disable-next-line no-console
    console.log(`[RTC] Starting to send file ${file.name} to ${peerId}`)

    const metadata = { name: file.name, type: file.type, size: file.size, isMetadata: true }
    dataChannel.send(JSON.stringify(metadata))

    let offset = 0
    const reader = new FileReader()

    const readSlice = (o: number) => {
      // 背压处理
      if (dataChannel.bufferedAmount > dataChannel.bufferedAmountLowThreshold) {
        dataChannel.onbufferedamountlow = () => {
          dataChannel.onbufferedamountlow = null // 只触发一次
          readSlice(o)
        }
        return
      }

      const slice = file.slice(o, o + CHUNK_SIZE)
      reader.readAsArrayBuffer(slice)
    }

    reader.onload = (e) => {
      const chunk = e.target?.result as ArrayBuffer
      if (dataChannel.readyState === 'open') {
        dataChannel.send(chunk)
        offset += chunk.byteLength

        // 关键改动: 通过回调通知上层发送方的进度
        dataChannelEventHandler?.onMessage(peerId, {
          type: 'sender_progress', // 一个新的、专门给发送方自己用的事件类型
          payload: {
            sentBytes: offset,
            totalBytes: file.size,
          },
        })

        if (offset < file.size) {
          readSlice(offset)
        }
        else {
          // eslint-disable-next-line no-console
          console.log(`[RTC] File ${file.name} sent successfully.`)
          dataChannel.send(JSON.stringify({ isTransferComplete: true }))
          // 发送完成时，也通知一下上层
          dataChannelEventHandler?.onMessage(peerId, {
            type: 'sender_complete',
            payload: {},
          })
        }
      }
    }

    readSlice(0)
  }

  async function handleRtcMessage(message: any) {
    const peerId = message.payload.senderId
    if (!peerId)
      return

    // 注意：这里我们无法获取到对方的 ICE 配置，所以使用默认值。
    // 这对于接收 Offer 来说是可行的，因为配置主要影响本地候选者的生成。
    const pc = getOrCreatePeerConnection(peerId, { iceServers: ICE_SERVERS }) // 使用默认配置

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

  function closeDataChannel(peerId: string) {
    const dataChannel = dataChannels.get(peerId)
    if (dataChannel) {
      // eslint-disable-next-line no-console
      console.log(`[RTC] Manually closing data channel with ${peerId}`)
      dataChannel.close()
      dataChannels.delete(peerId) // 从 Map 中移除
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
    closeDataChannel,
    sendFile, // 暴露 sendFile 方法
    onDataChannelEvents: (handler: DataChannelEventHandler) => { dataChannelEventHandler = handler },
    onIceCandidate: (handler: IceCandidateHandler) => { iceCandidateHandler = handler }, // 新增
  }
}
