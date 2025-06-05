<script setup lang="ts">
interface User {
  id: string
  name: string
  avatar: string // 这将是 Unocss 的图标类名，例如 'i-twemoji-grinning-face'
}

interface MessageLog {
  type: 'received' | 'sent' | 'local_info' | 'error' | 'local_error'
  data?: any
  text?: string
}

const route = useRoute<'room-uuid'>()
const roomId = route.params.uuid

const messages = ref<MessageLog[]>([])
const ws = ref<WebSocket | null>(null)
const myClientId = ref<string | null>(null)
const myName = ref<string | null>(null)
const myAvatar = ref<string | null>(null)

const usersInRoom = ref<User[]>([]) // 存储房间内所有用户 (包括自己)
const inputMessage = ref('')

const SIGNALING_SERVER_URL = 'ws://localhost:8080'

function connectWebSocket() {
  if (!roomId || typeof roomId !== 'string') {
    console.error('房间 ID 无效，无法连接 WebSocket')
    messages.value.push({ type: 'local_error', text: '房间 ID 无效' })
    return
  }

  // eslint-disable-next-line no-console
  console.log(`尝试连接到信令服务器: ${SIGNALING_SERVER_URL}`)
  messages.value.push({ type: 'local_info', text: `正在连接到 ${SIGNALING_SERVER_URL}...` })

  const socket = new WebSocket(SIGNALING_SERVER_URL)

  socket.onopen = () => {
    // eslint-disable-next-line no-console
    console.log('成功连接到信令服务器')
    messages.value.push({ type: 'local_info', text: '已连接到信令服务器!' })
    ws.value = socket

    const joinMessage = {
      type: 'join_room',
      payload: {
        roomId,
      },
    }
    socket.send(JSON.stringify(joinMessage))
    messages.value.push({ type: 'sent', text: `发送加入房间请求: ${roomId}` })
  }

  socket.onmessage = (event) => {
    try {
      const messageData = JSON.parse(event.data as string)
      // eslint-disable-next-line no-console
      console.log('从服务器收到消息:', messageData)
      messages.value.push({ type: 'received', data: messageData })

      switch (messageData.type) {
        case 'room_joined':
          myClientId.value = messageData.payload?.clientId
          myName.value = messageData.payload?.name
          myAvatar.value = messageData.payload?.avatar
          // eslint-disable-next-line no-console
          console.log('我已加入房间:', myClientId.value, myName.value, myAvatar.value)
          // 将自己也添加到用户列表中，确保显示
          if (myClientId.value && myName.value && myAvatar.value) {
            const selfUser = { id: myClientId.value, name: myName.value, avatar: myAvatar.value }
            // 避免重复添加 (虽然理论上 room_joined 只会收到一次)
            if (!usersInRoom.value.find(u => u.id === selfUser.id)) {
              usersInRoom.value.push(selfUser)
            }
          }
          break
        case 'existing_users': {
          // 设置房间内已存在的用户 (不包括自己，因为自己会通过 room_joined 单独处理，或者服务器可以统一处理)
          // 当前服务器逻辑：existing_users 发送给新加入者，不包含新加入者自己
          // 然后新加入者会收到 room_joined 包含自己的信息
          // 其他人会收到 user_joined 包含新加入者的信息
          const existingUsers = messageData.payload?.users as User[]
          if (existingUsers) {
            // 合并，确保不重复 (基于 id)
            existingUsers.forEach((newUser) => {
              if (!usersInRoom.value.find(u => u.id === newUser.id)) {
                usersInRoom.value.push(newUser)
              }
            })
            // eslint-disable-next-line no-console
            console.log('收到现有用户列表:', usersInRoom.value)
          }
          break
        }
        case 'user_joined':{
          const newUser = messageData.payload as User
          if (newUser && newUser.id && newUser.name && newUser.avatar) {
            // 服务端返回的是 userId，我们统一用 id
            const userToAdd = { id: newUser.id, name: newUser.name, avatar: newUser.avatar }
            if (!usersInRoom.value.find(u => u.id === userToAdd.id)) {
              usersInRoom.value.push(userToAdd)
              // eslint-disable-next-line no-console
              console.log(`用户 ${userToAdd.name} (${userToAdd.id}) 加入了房间`)
            }
          }
          break
        }
        case 'user_left':{
          const leftUserId = messageData.payload?.userId
          if (leftUserId) {
            usersInRoom.value = usersInRoom.value.filter(user => user.id !== leftUserId)
            // eslint-disable-next-line no-console
            console.log(`用户 ${leftUserId} 离开了房间`)
          }
          break
        }
        case 'room_message':{
          // eslint-disable-next-line no-console
          console.log(`房间消息来自 ${messageData.payload?.senderName} (${messageData.payload?.senderId}): ${messageData.payload?.data}`)
          // TODO: 显示聊天消息或处理其他房间广播数据
          break
        }
      }
    }
    catch (e) {
      console.error('解析服务器消息失败:', event.data, e)
      messages.value.push({ type: 'error', text: `解析服务器消息失败: ${event.data}` })
    }
  }

  socket.onerror = (error) => {
    console.error('WebSocket 错误:', error)
    messages.value.push({ type: 'error', text: `WebSocket 错误: ${error}` })
    ws.value = null
  }

  socket.onclose = (event) => {
    // eslint-disable-next-line no-console
    console.log('与信令服务器的连接已关闭:', event.code, event.reason)
    messages.value.push({ type: 'local_info', text: `与信令服务器的连接已关闭. Code: ${event.code}` })
    ws.value = null
    myClientId.value = null
    myName.value = null
    myAvatar.value = null
    usersInRoom.value = [] // 清空用户列表
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
  }
  else {
    messages.value.push({ type: 'local_error', text: 'WebSocket 未连接或消息为空' })
  }
}

onMounted(() => {
  if (typeof roomId === 'string') {
  // eslint-disable-next-line no-console
    console.log('当前房间 ID:', roomId)
    connectWebSocket()
  }
  else {
    console.error('房间 ID 无效:', roomId)
    messages.value.push({ type: 'local_error', text: '房间 ID 无效，无法初始化' })
  }
})

onUnmounted(() => {
  if (ws.value) {
  // eslint-disable-next-line no-console
    console.log('组件卸载，关闭 WebSocket 连接')
    ws.value.close()
  }
})

// 计算属性，用于UI上区分自己和其他用户
const otherUsers = computed(() => usersInRoom.value.filter(user => user.id !== myClientId.value))
const selfUser = computed(() => usersInRoom.value.find(user => user.id === myClientId.value))
</script>

<template>
  <div class="mx-auto p-4 container">
    <h1 class="text-2xl font-bold mb-1">
      房间号: {{ roomId }}
    </h1>
    <div v-if="selfUser" class="text-sm text-gray-600 mb-4 dark:text-gray-400">
      <p>你好, <span class="font-semibold">{{ selfUser.name }}</span>!</p>
      <p>
        你的头像: <span :class="selfUser.avatar" class="ml-1 h-5 w-5 inline-block" /> (ID: {{ selfUser.id }})
      </p>
    </div>
    <p class="mb-2">
      将此页面的链接分享给其他人，让他们加入这个房间进行文件互传。
    </p>

    <div class="my-4">
      <h3 class="text-lg font-semibold mb-2">
        发送测试广播消息:
      </h3>
      <div class="flex gap-2">
        <input
          v-model="inputMessage"
          type="text"
          class="p-2 border rounded flex-grow dark:border-gray-600 dark:bg-gray-700"
          placeholder="输入消息..."
          @keyup.enter="sendBroadcastMessage"
        >
        <button
          class="text-white px-4 py-2 rounded bg-blue-500 hover:bg-blue-600"
          @click="sendBroadcastMessage"
        >
          发送
        </button>
      </div>
    </div>

    <div class="mt-8">
      <h2 class="text-xl mb-2">
        房间内的用户 ({{ usersInRoom.length }}):
      </h2>
      <div v-if="usersInRoom.length > 0" class="gap-4 grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3">
        <div
          v-for="user in usersInRoom"
          :key="user.id"
          class="user-card p-4 border rounded-lg flex flex-col cursor-pointer shadow transition-all items-center dark:border-gray-700 hover:shadow-md dark:hover:border-gray-500"
          :class="{ 'border-green-500 dark:border-green-400 ring-2 ring-green-500 dark:ring-green-400': user.id === myClientId }"
          @click="user.id !== myClientId ? console.log('TODO: Clicked on user', user.name) : null"
        >
          <!-- 使用动态 class 绑定头像 -->
          <div :class="user.avatar" class="text-5xl mb-2 h-16 w-16" />
          <span class="font-semibold truncate" :title="user.name">{{ user.name }}</span>
          <span v-if="user.id === myClientId" class="text-xs text-gray-500 dark:text-gray-400">(你)</span>
        </div>
      </div>
      <p v-else class="text-gray-500 dark:text-gray-400">
        房间内还没有其他用户。
      </p>
    </div>

    <div class="mt-8">
      <!-- ... (信令消息日志 UI 保持不变) ... -->
      <h3 class="text-lg font-semibold mb-2">
        信令消息日志:
      </h3>
      <div class="text-sm p-2 border rounded bg-gray-50 max-h-96 overflow-y-auto dark:border-gray-700 dark:bg-gray-800">
        <div v-for="(msg, index) in messages" :key="index" class="font-mono mb-1">
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
/* Unocss 应该已经包含了 i-twemoji-* 这样的图标类，如果没有，需要确保 @unocss/preset-icons 已配置 */
.user-card .truncate {
  max-width: 100px; /* 或者其他适合的宽度 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
