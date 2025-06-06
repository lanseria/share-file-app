<script setup lang="ts">
// app/components/UserCard.vue

interface Props {
  user: UserWithStatus
  isSelf: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', userId: string): void
}>()

function handleClick() {
  if (!props.isSelf) {
    emit('select', props.user.id)
  }
}

// 计算属性，用于生成状态提示和图标
const rtcStatusInfo = computed(() => {
  const state = props.user.rtcState
  switch (state) {
    case 'connected':
    case 'completed':
      return { text: '已连接', icon: 'i-carbon-wifi', color: 'text-green-500' }
    case 'checking':
      return { text: '连接中...', icon: 'i-carbon-wifi-off', color: 'text-yellow-500 animate-pulse' }
    case 'disconnected':
    case 'failed':
    case 'closed':
      return { text: '已断开', icon: 'i-carbon-wifi-off', color: 'text-red-500' }
    case 'no-connection':
    default:
      return { text: '未连接', icon: 'i-carbon-wifi-off', color: 'text-gray-400' }
  }
})
</script>

<template>
  <div
    class="user-card p-4 border rounded-lg flex flex-col cursor-pointer shadow transition-all items-center dark:border-gray-700 hover:shadow-md dark:hover:border-gray-500"
    :class="{ 'border-green-500 ring-2 ring-green-500 dark:border-green-400 dark:ring-green-400': isSelf }"
    @click="handleClick"
  >
    <div :class="user.avatar" class="text-5xl mb-2 h-16 w-16" />
    <span class="font-semibold truncate" :title="user.name">{{ user.name }}</span>
    <span v-if="isSelf" class="text-xs text-gray-500 dark:text-gray-400">(你)</span>

    <!-- 新增: WebRTC 连接状态指示器 -->
    <div v-if="!isSelf" class="text-xs mt-2 flex gap-1 items-center" :class="rtcStatusInfo.color">
      <div :class="rtcStatusInfo.icon" />
      <span>{{ rtcStatusInfo.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.user-card .truncate {
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
