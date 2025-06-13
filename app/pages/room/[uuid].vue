<script setup lang="ts">
// app/pages/room/[uuid].vue

const route = useRoute<'room-uuid'>()
const roomId = route.params.uuid

// 只需使用一个顶层 Composable
const {
  messages,
  usersInRoom,
  chatMessages,
  myClientId,
  myName,
  myAvatar,
  isConnected,
  join, // 使用 join 方法
  sendChatMessage,
  transferStates,
  incomingRequests,
  selectFileForPeer,
  acceptFileRequest,
  rejectFileRequest,
  cancelTransfer,
  // 新增: 解构 ICE 调试相关的状态
  editableIceServers,
  iceTransportPolicy,
  iceCandidateLog,
  manualDetectNat, // 获取手动检测方法

} = useRoom(roomId)

// 页面加载时自动加入房间
onMounted(() => {
  join()
})
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

    <!-- 用户网格组件 -->
    <UserGrid
      :users="usersInRoom"
      :my-client-id="myClientId"
      :transfer-states="transferStates"
      :incoming-requests="incomingRequests"
      @select-user="selectFileForPeer"
      @accept-request="acceptFileRequest"
      @reject-request="rejectFileRequest"
      @cancel-transfer="cancelTransfer"
      @detect-nat="manualDetectNat"
    />

    <!-- !! 新增: ChatBox 组件 !! -->
    <ChatBox
      :messages="chatMessages"
      :my-client-id="myClientId"
      @send-message="sendChatMessage"
    />

    <!-- !! 新增: FAQ 帮助部分 !! -->
    <FaqSection />

    <!-- !! 新增: ICE 调试组件 !! -->
    <IceDebug
      v-model:ice-servers="editableIceServers"
      v-model:ice-transport-policy="iceTransportPolicy"
      :ice-candidate-log="iceCandidateLog"
    />

    <!-- 消息日志组件 -->
    <MessageLog :messages="messages" />
  </div>
</template>
