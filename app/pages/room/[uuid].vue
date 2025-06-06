<script setup lang="ts">
// app/pages/room/[uuid].vue

const route = useRoute<'room-uuid'>()
const roomId = route.params.uuid

// 只需使用一个顶层 Composable
const {
  messages,
  usersInRoom,
  myClientId,
  myName,
  myAvatar,
  isConnected,
  join, // 使用 join 方法
  sendMessage,
  transferStates,
  incomingRequests,
  selectFileForPeer,
  acceptFileRequest,
  rejectFileRequest,
  manualInitiateConnection, // 确保这里解构出来了
} = useRoom(roomId)

// 页面加载时自动加入房间
onMounted(() => {
  join()
})

// 用于测试广播消息
const inputMessage = ref('')
function sendBroadcastMessage() {
  if (inputMessage.value.trim() !== '') {
    sendMessage('broadcast_message', { data: inputMessage.value.trim() })
    inputMessage.value = ''
  }
}
</script>

<template>
  <div class="mx-auto p-4 container">
    <!-- 头部信息 -->
    <h1 class="text-2xl font-bold mb-1">
      房间号: {{ roomId }}
    </h1>
    <div v-if="isConnected && myClientId" class="text-sm text-gray-600 mb-4 dark:text-gray-400">
      <p>你好, <span class="font-semibold">{{ myName }}</span>!</p>
      <p>
        你的头像: <span :class="myAvatar" class="ml-1 h-5 w-5 inline-block" />
      </p>
    </div>
    <p class="mb-2">
      将此页面的链接分享给其他人，让他们加入这个房间进行文件互传。
    </p>

    <!-- 测试广播消息 (可以保留用于调试) -->
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

    <!-- 用户网格组件 -->
    <UserGrid
      :users="usersInRoom"
      :my-client-id="myClientId"
      :transfer-states="transferStates"
      :incoming-requests="incomingRequests"
      @select-user="selectFileForPeer"
      @accept-request="acceptFileRequest"
      @reject-request="rejectFileRequest"
      @reconnect-user="manualInitiateConnection"
    />

    <!-- 消息日志组件 -->
    <MessageLog :messages="messages" />
  </div>
</template>
