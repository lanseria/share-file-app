// app/composables/useRoom.ts
export interface User {
  id: string
  name: string
  avatar: string
}
// 扩展 User 接口，包含连接状态

export interface UserWithStatus extends User { rtcState: RTCIceConnectionState | 'no-connection' }

export interface MessageLog {
  type: 'received' | 'sent' | 'local_info' | 'error' | 'local_error'
  data?: any
  text?: string
}

export function useRoom(roomId: string) {
  // 状态
  const messages = ref<MessageLog[]>([])
  const usersInRoom = ref<User[]>([])
  const myClientId = ref<string | null>(null)
  const myName = ref<string | null>(null)
  const myAvatar = ref<string | null>(null)

  // 实例化底层模块
  const ws = useWebSocketCore()
  const rtc = useWebRtcManager(ws.sendMessage) // 将 ws 的发送函数注入 rtc 管理器
  const fileTransfer = useFileTransfer()

  // 文件选择相关
  const { files, open, reset } = useFileDialog({ multiple: false })

  let fileToSend: File | null = null
  let peerToSendTo: string | null = null

  watch(files, (selectedFiles) => {
    const file = selectedFiles?.[0]
    if (file && peerToSendTo) {
      fileToSend = file
      const metadata: FileMetadata = { name: file.name, size: file.size, type: file.type }
      ws.sendMessage('file_transfer_request', { targetId: peerToSendTo, file: metadata })
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
        case 'end': {
          // 接收方: 文件接收完成，触发下载
          fileTransfer.completeTransfer(peerId)
          const { blob, name } = message.payload
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = name
          a.click()
          URL.revokeObjectURL(url)
          break
        }
        case 'progress': {
          // 接收方: 更新进度条
          if (message.payload.receivedBytes) {
            const progress = Math.round((message.payload.receivedBytes / message.payload.totalBytes) * 100)
            fileTransfer.updateTransferProgress(peerId, progress)
          }
          break
        }
        // 新增: 发送方处理自己的进度更新
        case 'sender_progress': {
          const progress = Math.round((message.payload.sentBytes / message.payload.totalBytes) * 100)
          fileTransfer.updateTransferProgress(peerId, progress)
          break
        }

        // 新增: 发送方处理自己的完成状态
        case 'sender_complete': {
          fileTransfer.completeTransfer(peerId)
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
      case 'room_joined': {
        myClientId.value = message.payload?.clientId
        myName.value = message.payload?.name
        myAvatar.value = message.payload?.avatar
        if (myClientId.value && myName.value && myAvatar.value) {
          const selfUser = { id: myClientId.value, name: myName.value, avatar: myAvatar.value }
          if (!usersInRoom.value.find(u => u.id === selfUser.id)) {
            usersInRoom.value.push(selfUser)
          }
        }
        break
      }
      case 'existing_users': {
        const existingUsers = message.payload?.users as User[]
        if (existingUsers) {
          existingUsers.forEach((newUser) => {
            if (!usersInRoom.value.find(u => u.id === newUser.id)) {
              usersInRoom.value.push(newUser)
            }
          })
        }
        break
      }
      case 'user_joined': {
        const joinedUserPayload = message.payload
        if (joinedUserPayload && joinedUserPayload.id && joinedUserPayload.name && joinedUserPayload.avatar) {
          const userToAdd: User = { id: joinedUserPayload.id, name: joinedUserPayload.name, avatar: joinedUserPayload.avatar }
          if (userToAdd.id !== myClientId.value && !usersInRoom.value.find(u => u.id === userToAdd.id)) {
            usersInRoom.value.push(userToAdd)
          }
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
    }
  }
  // 将 WebSocket 的 onMessage 指向我们的处理器
  ws.onMessage(handleWebSocketMessage)

  // 监听用户列表变化以自动建立 WebRTC 连接
  watch(
    () => [...usersInRoom.value], // 关键改动：监听一个返回数组浅拷贝的 getter
    (newUsers, oldUsers) => {
      // eslint-disable-next-line no-console
      console.log('User list changed. New length:', newUsers.length, 'Old length:', oldUsers.length)
      if (!myClientId.value)
        return
      const newPeers = newUsers.filter(u => u.id !== myClientId.value && !oldUsers.find(ou => ou.id === u.id))
      newPeers.forEach((peer) => {
        if (myClientId.value! < peer.id) {
          rtc.initiatePeerConnection(peer.id)
        }
      })
    },
    { deep: true },
  )

  // 新增: 创建一个计算属性，将用户列表和 WebRTC 连接状态合并
  const usersWithRtcStatus = computed<UserWithStatus[]>(() => {
    return usersInRoom.value.map(user => ({
      ...user,
      // 从 rtc.peerConnectionStates 中获取状态，如果没有则表示 'no-connection'
      rtcState: rtc.peerConnectionStates.get(user.id) || 'no-connection',
    }))
  })

  function join() {
    ws.connect()
    // ws.onopen 之后, 我们在 handleWebSocketMessage 中通过 room_joined 确认加入成功
    // 但 ws.connect 应该立即触发加入房间的请求
    // 我们可以监听 ws.isConnected
    const stopWatch = watch(ws.isConnected, (connected) => {
      if (connected) {
        ws.sendMessage('join_room', { roomId })
        messages.value.push({ type: 'sent', text: `发送加入房间请求: ${roomId}` })
        stopWatch() // 只需发送一次
      }
    })
  }

  function leave() {
    ws.disconnect() // 这会触发 onclose，并清理所有状态
  }

  function selectFileForPeer(peerId: string) {
    peerToSendTo = peerId
    open()
  }

  function acceptFileRequest(peerId: string) {
    ws.sendMessage('file_transfer_accepted', { targetId: peerId })
    const request = fileTransfer.incomingRequests.get(peerId)
    if (request) {
      fileTransfer.createTransferState(peerId, request.file, false)
      fileTransfer.removeIncomingRequest(peerId)
    }
  }

  function rejectFileRequest(peerId: string) {
    ws.sendMessage('file_transfer_rejected', { targetId: peerId })
    fileTransfer.removeIncomingRequest(peerId)
  }

  onUnmounted(() => {
    leave() // 确保离开页面时断开连接
  })

  return {
    messages,
    usersInRoom: usersWithRtcStatus, // 对外暴露合并后的用户列表
    myClientId,
    myName,
    myAvatar,
    isConnected: ws.isConnected, // 直接透传 isConnected 状态

    join,
    leave,
    // 透传一个通用的发送消息方法，用于如测试广播等
    sendMessage: ws.sendMessage,
    transferStates: fileTransfer.transferStates,
    incomingRequests: fileTransfer.incomingRequests,
    selectFileForPeer,
    acceptFileRequest,
    rejectFileRequest,
  }
}
