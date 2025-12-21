<!-- app/components/ChatBox.vue -->
<script setup lang="ts">
import type { ChatMessage } from '~/composables/useRoom'

const props = defineProps<{
  messages: ChatMessage[]
  myClientId: string | null
}>()

const emit = defineEmits<{
  (e: 'send-message', text: string): void
}>()

const newMessage = ref('')
const chatContainer = ref<HTMLElement | null>(null)

function handleSend() {
  if (newMessage.value.trim()) {
    emit('send-message', newMessage.value)
    newMessage.value = ''
  }
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// 自动滚动到底部
watch(() => props.messages, async () => {
  await nextTick()
  if (chatContainer.value)
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
}, { deep: true })
</script>

<template>
  <div class="my-4 md:my-8">
    <div class="p-4 border rounded-lg dark:border-gray-700">
      <h3 class="text-lg font-semibold mb-4 text-left">
        房间聊天
      </h3>
      <!-- 消息列表 -->
      <div ref="chatContainer" class="pr-2 h-64 max-h-64 overflow-y-auto space-y-4">
        <div v-if="messages.length === 0" class="text-gray-400 flex h-full items-center justify-center">
          还没有消息，快来发起群聊吧！
        </div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex gap-3 items-end"
          :class="{ 'flex-row-reverse': msg.senderId === myClientId }"
        >
          <!-- 头像 -->
          <div :class="msg.senderAvatar" class="text-3xl flex-shrink-0 h-8 w-8" />
          <!-- 消息内容 -->
          <div class="flex flex-col max-w-[80%]" :class="{ 'items-end': msg.senderId === myClientId, 'items-start': msg.senderId !== myClientId }">
            <!-- 昵称和时间 -->
            <div class="text-xs text-gray-500 mb-1 dark:text-gray-400">
              <span>{{ msg.senderName }}</span>
              <span class="mx-1">•</span>
              <span>{{ formatTimestamp(msg.timestamp) }}</span>
            </div>
            <!-- 消息气泡 -->
            <div
              class="text-sm p-3 rounded-lg"
              :class="{
                'bg-blue-500 text-white rounded-br-none': msg.senderId === myClientId,
                'bg-gray-200 text-gray-800 rounded-bl-none dark:bg-gray-700 dark:text-gray-200': msg.senderId !== myClientId,
              }"
            >
              {{ msg.text }}
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="mt-4 pt-4 border-t flex gap-2 dark:border-gray-600">
        <input
          v-model="newMessage"
          type="text"
          class="p-2 border rounded flex-grow dark:border-gray-600 dark:bg-gray-800"
          placeholder="输入消息..."
          @keyup.enter="handleSend"
        >
        <button
          class="text-white px-4 py-2 rounded bg-blue-500 transition-colors disabled:bg-gray-400 hover:bg-blue-600"
          :disabled="!newMessage.trim()"
          @click="handleSend"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>
