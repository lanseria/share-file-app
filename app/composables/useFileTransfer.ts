// app/composables/useFileTransfer.ts

// 文件元数据接口
export interface FileMetadata {
  name: string
  size: number
  type: string
}

// 文件传输请求状态
export interface TransferRequest {
  from: User
  file: FileMetadata
}

// 文件传输进度状态
export interface TransferProgress {
  peerId: string
  state: 'requesting' | 'transferring' | 'completed' | 'rejected' | 'failed'
  progress: number // 0-100
  fileName: string
  fileSize: number
  isSender: boolean // 标记是发送方还是接收方
  speed: number // 字节/秒 (Bytes/s)
}

export function useFileTransfer() {
  // 使用 reactive Map 来存储每个 peer 的传输状态
  const transferStates = reactive<Map<string, TransferProgress>>(new Map())

  // 存储待确认的文件传输请求
  const incomingRequests = reactive<Map<string, TransferRequest>>(new Map())

  function addIncomingRequest(from: User, file: FileMetadata) {
    incomingRequests.set(from.id, { from, file })
  }

  function removeIncomingRequest(peerId: string) {
    incomingRequests.delete(peerId)
  }

  function createTransferState(peerId: string, file: FileMetadata, isSender: boolean) {
    transferStates.set(peerId, {
      peerId,
      state: 'requesting',
      progress: 0,
      fileName: file.name,
      fileSize: file.size,
      isSender,
      speed: 0, // 初始化速度为 0
    })
  }
  // 新增: 更新速度的方法
  function updateTransferSpeed(peerId: string, bytesPerSecond: number) {
    const state = transferStates.get(peerId)
    if (state) {
      state.speed = bytesPerSecond
    }
  }

  function updateTransferProgress(peerId: string, progress: number) {
    const state = transferStates.get(peerId)
    if (state) {
      state.progress = progress
      if (state.state !== 'transferring') {
        state.state = 'transferring'
      }
    }
  }

  function completeTransfer(peerId: string) {
    const state = transferStates.get(peerId)
    if (state) {
      state.state = 'completed'
      state.progress = 100
      // 可以在一段时间后清除已完成的状态
      setTimeout(() => {
        transferStates.delete(peerId)
      }, 5000)
    }
  }

  function rejectTransfer(peerId: string) {
    const state = transferStates.get(peerId)
    if (state) {
      state.state = 'rejected'
    }
    setTimeout(() => {
      transferStates.delete(peerId)
    }, 5000)
  }

  function failTransfer(peerId: string) {
    const state = transferStates.get(peerId)
    if (state && state.state !== 'completed') {
      state.state = 'failed'
    }
    setTimeout(() => {
      transferStates.delete(peerId)
    }, 5000)
  }

  return {
    transferStates,
    incomingRequests,
    addIncomingRequest,
    removeIncomingRequest,
    createTransferState,
    updateTransferProgress,
    completeTransfer,
    rejectTransfer,
    failTransfer,
    updateTransferSpeed, // 暴露新方法
  }
}
