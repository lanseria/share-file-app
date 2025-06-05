<script setup lang="ts">
const route = useRoute()
const roomId = computed(() => route.params.uuid as string) // 获取动态路由参数

const messages = ref<any[]>([]) // 用于显示从服务器收到的消息 (测试用)
const ws = ref<WebSocket | null>(null)
const clientId = ref<string | null>(null) // 从服务器获取的客户端ID
const inputMessage = ref('') // 用于发送测试消息

// 信令服务器地址 (根据你的部署情况修改)
// 如果在本地开发，信令服务器运行在 8080 端口
const SIGNALING_SERVER_URL = 'ws://localhost:8080'

function connectWebSocket() {
  if (!roomId.value || typeof roomId.value !== 'string') {
    console.error('房间 ID 无效，无法连接 WebSocket')
    messages.value.push({ type: 'local_error', text: '房间 ID 无效' })
    return
  }

  console.log(`尝试连接到信令服务器: ${SIGNALING_SERVER_URL}`)
  messages.value.push({ type: 'local_info', text: `正在连接到 ${SIGNALING_SERVER_URL}...` })

  const socket = new WebSocket(SIGNALING_SERVER_URL)

  socket.onopen = () => {
    console.log('成功连接到信令服务器')
    messages.value.push({ type: 'local_info', text: '已连接到信令服务器!' })
    ws.value = socket

    // 连接成功后，加入房间
    const joinMessage = {
      type: 'join_room',
      payload: {
        roomId: roomId.value,
      },
    }
    socket.send(JSON.stringify(joinMessage))
    messages.value.push({ type: 'sent', text: `发送加入房间请求: ${roomId.value}` })
  }

  socket.onmessage = (event) => {
    try {
      const messageData = JSON.parse(event.data as string)
      console.log('从服务器收到消息:', messageData)
      messages.value.push({ type: 'received', data: messageData })

      // 处理从服务器获取的 clientId
      if (messageData.type === 'room_joined' && messageData.payload?.clientId) {
        clientId.value = messageData.payload.clientId
        console.log('我的客户端 ID:', clientId.value)
      }

      // 处理其他用户加入/离开的通知 (后续UI会用到)
      if (messageData.type === 'user_joined') {
        console.log(`用户 ${messageData.payload?.userId} 加入了房间`)
        // TODO: 更新用户列表UI
      }
      if (messageData.type === 'user_left') {
        console.log(`用户 ${messageData.payload?.userId} 离开了房间`)
        // TODO: 更新用户列表UI
      }
      if (messageData.type === 'room_message') {
        console.log(`房间消息来自 ${messageData.payload?.senderId}: ${messageData.payload?.data}`)
        // TODO: 显示聊天消息或处理其他房间广播数据
      }

    } catch (e) {
      console.error('解析服务器消息失败:', event.data, e)
      messages.value.push({ type: 'error', text: `解析服务器消息失败: ${event.data}` })
    }
  }

  socket.onerror = (error) => {
    console.error('WebSocket 错误:', error)
    messages.value.push({ type: 'error', text: `WebSocket 错误: ${error}` })
    ws.value = null // 连接出错，重置 ws 实例
  }

  socket.onclose = (event) => {
    console.log('与信令服务器的连接已关闭:', event.code, event.reason)
    messages.value.push({ type: 'local_info', text: `与信令服务器的连接已关闭. Code: ${event.code}` })
    ws.value = null // 连接关闭，重置 ws 实例
    clientId.value = null
    // 可以考虑在这里实现重连逻辑
  }
}

function sendBroadcastMessage() {
  if (ws.value && ws.value.readyState === WebSocket.OPEN && inputMessage.value.trim() !== '') {
    const message = {
      type: 'broadcast_message',
      payload: {
        data: inputMessage.value.trim(),
      },
    }
    ws.value.send(JSON.stringify(message))
    messages.value.push({ type: 'sent', text: `发送广播消息: ${inputMessage.value.trim()}` })
    inputMessage.value = ''
  } else {
    messages.value.push({ type: 'local_error', text: 'WebSocket 未连接或消息为空' })
  }
}

onMounted(() => {
  if (typeof roomId.value === 'string') {
    console.log('当前房间 ID:', roomId.value)
    connectWebSocket() // 页面加载时连接 WebSocket
  }
  else {
    console.error('房间 ID 无效:', roomId.value)
    messages.value.push({ type: 'local_error', text: '房间 ID 无效，无法初始化' })
  }
})

onUnmounted(() => {
  if (ws.value) {
    console.log('组件卸载，关闭 WebSocket 连接')
    ws.value.close()
  }
})
</script>

<template>
   <div class="container mx-auto p-4">
    <h1 class="mb-4 text-2xl font-bold">
      房间号: {{ roomId }}
    </h1>
    <p v-if="clientId" class="mb-2 text-sm text-gray-600 dark:text-gray-400">
      我的客户端 ID: {{ clientId }}
    </p>
    <p class="mb-2">
      将此页面的链接分享给其他人，让他们加入这个房间进行文件互传。
    </p>

    <div class="my-4">
      <h3 class="mb-2 text-lg font-semibold">
        发送测试广播消息:
      </h3>
      <div class="flex gap-2">
        <input
          v-model="inputMessage"
          type="text"
          class="flex-grow rounded border p-2 dark:bg-gray-700 dark:border-gray-600"
          placeholder="输入消息..."
          @keyup.enter="sendBroadcastMessage"
        >
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          @click="sendBroadcastMessage"
        >
          发送
        </button>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="mb-2 text-xl">
        房间内的用户：
      </h2>
      <!-- TODO: 用户列表 UI (类似 AirDrop) -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <!-- 示例用户卡片 -->
        <div class="user-card flex flex-col items-center rounded-lg border p-4 shadow dark:border-gray-700">
          <div class="i-carbon-user-avatar-filled mb-2 h-16 w-16 text-5xl" />
          <span class="font-semibold">用户 A</span>
        </div>
        <div class="user-card flex flex-col items-center rounded-lg border p-4 shadow dark:border-gray-700">
          <div class="i-carbon-user-avatar-filled mb-2 h-16 w-16 text-5xl" />
          <span class="font-semibold">用户 B (自己)</span>
        </div>
        <!-- 更多用户... -->
      </div>
    </div>

    <div class="mt-8">
      <h3 class="mb-2 text-lg font-semibold">
        信令消息日志:
      </h3>
      <div class="max-h-96 overflow-y-auto rounded border bg-gray-50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800">
        <div v-for="(msg, index) in messages" :key="index" class="mb-1 font-mono">
          <span
            :class="{
              'text-green-600 dark:text-green-400': msg.type === 'received' || msg.type === 'room_joined',
              'text-blue-600 dark:text-blue-400': msg.type === 'sent',
              'text-yellow-600 dark:text-yellow-400': msg.type === 'local_info',
              'text-red-600 dark:text-red-400': msg.type === 'error' || msg.type === 'local_error',
            }"
          >
            [{{ msg.type }}]
          </span>
          <template v-if="msg.data">
            {{ JSON.stringify(msg.data) }}
          </template>
          <template v-else>
            {{ msg.text }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 你可以在这里添加特定于此页面的样式，或者使用 Unocss 原子类 */
.user-card {
  /* Unocss 已经处理了大部分样式，这里可以放一些特殊覆盖 */
}
</style>