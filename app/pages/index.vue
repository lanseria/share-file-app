<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'

const router = useRouter()

function createRoom() {
  const newRoomId = uuidv4()
  router.push(`/room/${newRoomId}`)
}
</script>

<template>
  <div class="p-10 text-center flex flex-col h-[calc(100vh-100px)] items-center justify-center">
    <div class="i-carbon-p2p text-8xl mb-4" />
    <h1 class="text-4xl font-bold mb-2">
      Share File App
    </h1>
    <p class="text-gray-500 mb-8 dark:text-gray-400">
      简单、快速、安全的 P2P 文件分享
    </p>
    <button
      class="text-white font-semibold px-6 py-3 rounded-lg bg-blue-500 transition-colors hover:bg-blue-600"
      @click="createRoom"
    >
      创建新房间
    </button>
  </div>
</template>
