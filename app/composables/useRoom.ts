// app/composables/useRoom.ts
export interface User {
  id: string
  name: string
  avatar: string
  natType?: string // 可选的 natType 字段
}
// 扩展 User 接口，包含连接状态

export interface UserWithStatus extends User { rtcState: RTCIceConnectionState | 'no-connection' }

export interface MessageLog {
  type: 'received' | 'sent' | 'local_info' | 'error' | 'local_error'
  data?: any
  text?: string
}

export interface IceCandidateLogEntry {
  time: number
  type: 'host' | 'srflx' | 'prflx' | 'relay' | 'done' | 'error'
  foundation?: string
  protocol?: 'udp' | 'tcp'
  address?: string
  port?: number
  priority?: number
  url?: string
  relayProtocol?: 'udp' | 'tcp' | 'tls'
  errorText?: string
}

export function useRoom(roomId: string) {
  // 状态
  const messages = ref<MessageLog[]>([])
  const usersInRoom = ref<User[]>([])
  const myClientId = ref<string | null>(null)
  const myName = ref<string | null>(null)
  const myAvatar = ref<string | null>(null)
  // --- 新增 ICE 调试相关状态 ---
  const editableIceServers = ref<RTCIceServer[]>([...ICE_SERVERS])
  const iceTransportPolicy = ref<'all' | 'relay'>('all')
  const iceCandidateLog = ref<IceCandidateLogEntry[]>([])

  // 实例化底层模块
  const wsStore = useWebSocketStore() // 使用 store
  const rtc = useWebRtcManager(wsStore.sendMessage) // 将 ws 的发送函数注入 rtc 管理器
  // --- 注册新的事件处理器 ---
  rtc.onIceCandidate((entry) => {
    iceCandidateLog.value.push(entry)
  })

  // --- 监听配置变化并重置连接 ---
  watch([editableIceServers, iceTransportPolicy], () => {
    console.warn('ICE configuration changed. Resetting all peer connections.')
    // 1. 清空日志
    iceCandidateLog.value = []
    // 2. 关闭所有现有连接
    rtc.closeAllPeerConnections()
    // 3. 遍历现有用户，用新配置重新发起连接
    usersInRoom.value.forEach((user) => {
      if (user.id !== myClientId.value) {
        // 使用一个小的延迟，确保旧连接完全关闭
        setTimeout(() => manualInitiateConnection(user.id), 100)
      }
    })
  }, { deep: true }) // deep watch for changes inside the array

  const fileTransfer = useFileTransfer()// 新增: 用于速度计算的状态

  const speedCalculationState = reactive<Map<string, { lastTimestamp: number, lastBytes: number }>>(new Map())

  // 文件选择相关
  const { files, open, reset } = useFileDialog({ multiple: false })

  let fileToSend: File | null = null
  let peerToSendTo: string | null = null

  watch(files, (selectedFiles) => {
    const file = selectedFiles?.[0]
    if (file && peerToSendTo) {
      fileToSend = file
      const metadata: FileMetadata = { name: file.name, size: file.size, type: file.type }
      wsStore.sendMessage('file_transfer_request', { targetId: peerToSendTo, file: metadata })
      fileTransfer.createTransferState(peerToSendTo, metadata, true)
    }
  })
  // 处理来自 WebRTC 管理器的 DataChannel 事件
  rtc.onDataChannelEvents({
    onOpen: (peerId) => {
      // eslint-disable-next-line no-console
      console.log(`[Room] DataChannel with ${peerId} opened.`)
      // 如果有待发送的文件，并且是发给这个 peer 的，现在可以发送了
      const state = fileTransfer.transferStates.get(peerId)
      if (state && state.isSender && state.state === 'requesting' && fileToSend && peerId === peerToSendTo) {
        // 这是一个不好的耦合，更好的方式是在 'file_transfer_accepted' 消息中触发
      }
    },
    onClose: (peerId) => { fileTransfer.failTransfer(peerId) },
    onMessage: (peerId, message) => { // message 是一个我们自己定义的对象，不是原始的 event.data
      switch (message.type) {
        case 'start': {
          // 接收方: 文件开始传输
          fileTransfer.createTransferState(peerId, message.payload, false)
          break
        }
        case 'progress': // 接收方进度
        case 'sender_progress': { // 发送方进度
          const state = speedCalculationState.get(peerId)
          const now = Date.now()
          const bytes = message.payload.receivedBytes ?? message.payload.sentBytes

          if (state) {
            const timeDiff = (now - state.lastTimestamp) / 1000 // 秒
            const bytesDiff = bytes - state.lastBytes

            if (timeDiff > 0) {
              const speed = bytesDiff / timeDiff
              fileTransfer.updateTransferSpeed(peerId, speed)
            }
          }

          // 更新或初始化状态
          speedCalculationState.set(peerId, { lastTimestamp: now, lastBytes: bytes })

          const progress = Math.round((bytes / message.payload.totalBytes) * 100)
          fileTransfer.updateTransferProgress(peerId, progress)
          break
        }
        case 'end': {
          // 接收方: 文件接收完成，触发下载
          fileTransfer.completeTransfer(peerId)
          speedCalculationState.delete(peerId) // 清理速度计算状态
          const { blob, name } = message.payload
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = name
          a.click()
          URL.revokeObjectURL(url)
          break
        }
        case 'sender_complete': {
          fileTransfer.completeTransfer(peerId)
          speedCalculationState.delete(peerId) // 清理速度计算状态
          // 清理状态，以便可以进行下一次传输
          fileToSend = null
          peerToSendTo = null
          reset()
          break
        }
      }
    },
  })

  // 将 WebSocket 消息路由到正确的处理器
  function handleWebSocketMessage(message: any) {
    messages.value.push({ type: 'received', data: message })

    switch (message.type) {
      // 房间逻辑
      case 'room_joined':
      case 'existing_users':
      case 'user_joined': {
        // 将所有用户更新逻辑统一处理
        const usersToProcess = message.type === 'existing_users'
          ? message.payload.users
          : [message.payload.type === 'room_joined' ? { ...message.payload, id: message.payload.clientId } : { ...message.payload, id: message.payload.id }]

        usersToProcess.forEach((rawUser: any) => {
          const user: User = {
            id: rawUser.id,
            name: rawUser.name,
            avatar: rawUser.avatar,
            natType: rawUser.natType || 'Unknown', // 如果服务器没有提供，则默认为 Detecting
          }

          const existingUserIndex = usersInRoom.value.findIndex(u => u.id === user.id)
          if (existingUserIndex > -1) {
            // 更新已存在用户
            usersInRoom.value[existingUserIndex] = { ...usersInRoom.value[existingUserIndex], ...user }
          }
          else {
            // 添加新用户
            usersInRoom.value.push(user)
          }
        })

        // 如果是 room_joined，设置自己的信息
        if (message.type === 'room_joined') {
          myClientId.value = message.payload.clientId
          myName.value = message.payload.name
          myAvatar.value = message.payload.avatar
        }
        break
      }
      case 'user_left': {
        const leftUserId = message.payload?.id
        if (leftUserId) {
          usersInRoom.value = usersInRoom.value.filter(user => user.id !== leftUserId)
          rtc.closePeerConnection(leftUserId) // 通知 WebRTC 管理器清理连接
        }
        break
      }

      // WebRTC 逻辑
      case 'offer':
      case 'answer':
      case 'candidate':
        rtc.handleRtcMessage(message)
        break

      // 其他消息
      case 'room_message':
        // ...
        break

      case 'file_transfer_request': {
        const sender = usersInRoom.value.find(u => u.id === message.payload.senderId)
        if (sender) { fileTransfer.addIncomingRequest(sender, message.payload.file) }
        break
      }
      case 'file_transfer_accepted': {
        const peerId = message.payload.senderId
        // eslint-disable-next-line no-console
        console.log(`[Room] ${peerId} accepted file transfer.`)
        if (fileToSend && peerId === peerToSendTo) {
          rtc.sendFile(peerId, fileToSend)
        }
        else {
          console.error('No file or matching peer to send to.')
        }
        break
      }
      case 'file_transfer_rejected': {
        const peerId = message.payload.senderId
        fileTransfer.rejectTransfer(peerId)
        // 清理状态
        fileToSend = null
        peerToSendTo = null
        reset()
        break
      }
      case 'file_transfer_cancelled': { // 新增
        const peerId = message.payload.senderId
        // eslint-disable-next-line no-console
        console.log(`[Room] ${peerId} cancelled the transfer.`)
        fileTransfer.failTransfer(peerId)
        rtc.closeDataChannel(peerId)
        break
      }
      // 新增 case
      case 'nat_type_info': {
        const userId = message.payload.id || message.payload.senderId
        const user = usersInRoom.value.find(u => u.id === userId)
        if (user) {
          // 直接更新用户的 natType 属性，Vue 的响应式系统会处理 UI 更新
          user.natType = message.payload.natType
          // eslint-disable-next-line no-console
          console.log(`Updated NAT type for ${user.name} via broadcast: ${user.natType}`)
        }
        break
      }
    }
  }
  // 将 WebSocket 的 onMessage 指向我们的处理器
  // 将 wsStore.onMessage(handleWebSocketMessage) 修改为：
  const unsubscribe = wsStore.onMessage(handleWebSocketMessage)

  // 监听用户列表变化以自动建立 WebRTC 连接
  // watch(
  //   () => [...usersInRoom.value],
  //   (newUsers, oldUsers) => {
  //     if (!myClientId.value)
  //       return
  //     const newPeers = newUsers.filter(u => u.id !== myClientId.value && !oldUsers.find(ou => ou.id === u.id))
  //     newPeers.forEach((peer) => {
  //       if (myClientId.value! < peer.id) {
  //         manualInitiateConnection(peer.id) // 使用 manualInitiateConnection 统一发起
  //       }
  //     })
  //   },
  //   { deep: true },
  // )

  // 新增: 创建一个计算属性，将用户列表和 WebRTC 连接状态合并
  const usersWithRtcStatus = computed<UserWithStatus[]>(() => {
    return usersInRoom.value.map(user => ({
      ...user,
      // 从 rtc.peerConnectionStates 中获取状态，如果没有则表示 'no-connection'
      rtcState: rtc.peerConnectionStates.get(user.id) || 'no-connection',
    }))
  })
  // 手动发起 WebRTC 连接的方法 (这个方法保持不变，但调用时机由用户决定)
  function manualInitiateConnection(peerId: string) {
    if (!myClientId.value || peerId === myClientId.value)
      return

    const state = rtc.peerConnectionStates.get(peerId)
    if (!state || state === 'failed' || state === 'disconnected' || state === 'closed') {
      const configuration: RTCConfiguration = {
        iceServers: editableIceServers.value, // 使用当前的配置
        iceTransportPolicy: iceTransportPolicy.value,
      }
      rtc.initiatePeerConnection(peerId, configuration)
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`[Room] Connection with ${peerId} is already in state: ${state}.`)
    }
  }

  function join() {
    wsStore.connect()
    // wsStore.onopen 之后, 我们在 handleWebSocketMessage 中通过 room_joined 确认加入成功
    // 但 wsStore.connect 应该立即触发加入房间的请求
    // 我们可以监听 wsStore.isConnected
    const stopWatch = watch(() => wsStore.isConnected, (connected) => {
      if (connected) {
        wsStore.sendMessage('join_room', { roomId })
        messages.value.push({ type: 'sent', text: `发送加入房间请求: ${roomId}` })
        stopWatch() // 只需发送一次
      }
    })
  }

  // -- 新的 NAT 检测触发方法 --
  async function manualDetectNat() {
    const self = usersInRoom.value.find(u => u.id === myClientId.value)
    if (self)
      self.natType = 'Detecting...'

    try {
      // 直接调用 store 的方法！
      const natType = await wsStore.testConnectivity()
      console.log('NAT detection process finished. Result:', natType)
      // 同样，不需要手动更新状态，等待服务器广播即可
    }
    catch (error) {
      console.error('Failed to detect NAT type:', error)
      if (self)
        self.natType = 'Failed'
    }
  }

  function leave() {
    wsStore.disconnect() // 这会触发 onclose，并清理所有状态
  }

  function selectFileForPeer(peerId: string) {
    peerToSendTo = peerId
    open()
  }

  function acceptFileRequest(peerId: string) {
    wsStore.sendMessage('file_transfer_accepted', { targetId: peerId })
    const request = fileTransfer.incomingRequests.get(peerId)
    if (request) {
      fileTransfer.createTransferState(peerId, request.file, false)
      fileTransfer.removeIncomingRequest(peerId)
    }
  }

  function rejectFileRequest(peerId: string) {
    wsStore.sendMessage('file_transfer_rejected', { targetId: peerId })
    fileTransfer.removeIncomingRequest(peerId)
  }

  // 新增: 取消传输的方法
  function cancelTransfer(peerId: string) {
    // eslint-disable-next-line no-console
    console.log(`[Room] Cancelling transfer with ${peerId}`)
    // 1. 通知对方
    wsStore.sendMessage('file_transfer_cancelled', { targetId: peerId })
    // 2. 在本地标记为失败
    fileTransfer.failTransfer(peerId)
    // 3. 关闭 DataChannel
    rtc.closeDataChannel(peerId)

    // 清理发送状态
    if (peerId === peerToSendTo) {
      fileToSend = null
      peerToSendTo = null
      reset()
    }
  }

  onUnmounted(() => {
    unsubscribe()
    leave() // 确保离开页面时断开连接
  })

  return {
    messages,
    usersInRoom: usersWithRtcStatus, // 对外暴露合并后的用户列表
    myClientId,
    myName,
    myAvatar,
    isConnected: wsStore.isConnected, // 直接透传 isConnected 状态

    // ICE Debug
    editableIceServers,
    iceTransportPolicy,
    iceCandidateLog,
    manualDetectNat, // 导出手动检测方法

    join,
    leave,
    // 透传一个通用的发送消息方法，用于如测试广播等
    sendMessage: wsStore.sendMessage,
    transferStates: fileTransfer.transferStates,
    incomingRequests: fileTransfer.incomingRequests,
    selectFileForPeer,
    acceptFileRequest,
    rejectFileRequest,
    manualInitiateConnection,
    cancelTransfer,
  }
}
