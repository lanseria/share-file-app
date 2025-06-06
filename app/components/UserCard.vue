<script setup lang="ts">
// app/components/UserCard.vue

interface Props {
  user: UserWithStatus
  isSelf: boolean
  incomingRequest?: TransferRequest
  transferState?: TransferProgress
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', userId: string): void
  (e: 'accept', userId: string): void
  (e: 'reject', userId: string): void
}>()
// 计算属性，判断该用户是否可进行文件传输
const isClickable = computed(() => {
  // 不是自己，且 WebRTC 连接状态为 'connected' 或 'completed'
  return !props.isSelf && (props.user.rtcState === 'connected' || props.user.rtcState === 'completed')
})

function handleClick() {
  if (isClickable.value) {
    emit('select', props.user.id)
  }
  else if (!props.isSelf) {
    // 可以给用户一个提示，为什么不能点击
    // eslint-disable-next-line no-console
    console.log(`无法向 ${props.user.name} 发送文件，因为连接状态是: ${props.user.rtcState}`)
    // 之后可以在这里弹出一个 Toast 通知
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
    class="user-card p-4 border rounded-lg flex flex-col shadow transition-all items-center dark:border-gray-700"
    :class="{
      'cursor-pointer hover:shadow-md dark:hover:border-gray-500': isClickable, // 只有可点击时才显示指针和悬浮效果
      'cursor-not-allowed opacity-75': !isSelf && !isClickable, // 对不可点击的用户显示禁用状态
      'border-green-500 ring-2 ring-green-500 dark:border-green-400 dark:ring-green-400': isSelf,
    }"
    @click="handleClick"
  >
    <div :class="user.avatar" class="text-5xl mb-2 h-16 w-16" />
    <span class="font-semibold truncate" :title="user.name">{{ user.name }}</span>
    <span v-if="isSelf" class="text-xs text-gray-500 dark:text-gray-400">(你)</span>
    <!-- 新增: 文件传输请求 UI -->
    <div v-if="incomingRequest" class="text-xs mt-2 p-2 text-center rounded-md bg-blue-100 w-full dark:bg-blue-900">
      <p class="font-semibold mb-1">
        想发送文件: {{ incomingRequest.file.name }}
      </p>
      <div class="flex gap-2 justify-center">
        <button class="text-white px-2 py-1 rounded bg-green-500" @click.stop="emit('accept', user.id)">
          接受
        </button>
        <button class="text-white px-2 py-1 rounded bg-red-500" @click.stop="emit('reject', user.id)">
          拒绝
        </button>
      </div>
    </div>

    <!-- 新增: 文件传输进度 UI -->
    <div v-if="transferState" class="text-xs mt-2 w-full">
      <p class="truncate">
        {{ transferState.fileName }}
      </p>
      <div class="rounded-full bg-gray-200 h-4 w-full relative dark:bg-gray-700">
        <div
          class="rounded-full bg-green-500 h-full absolute"
          :style="{ width: `${transferState.progress}%` }"
        />
        <span class="text-white text-center w-full absolute mix-blend-difference">
          {{ transferState.progress }}% - {{ transferState.state }}
        </span>
      </div>
    </div>
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
