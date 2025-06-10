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
  (e: 'reconnect', userId: string): void // 新增 reconnect 事件
  (e: 'cancel', userId: string): void // 新增
  (e: 'detect-nat'): void // 新增事件
}>()
// isClickable 计算属性现在只关心是否可以发起 *新* 的传输
const isClickable = computed(() => {
  if (props.transferState) {
    return false
  }
  return !props.isSelf && (props.user.rtcState === 'connected' || props.user.rtcState === 'completed')
})

// handleClick 只处理发起新传输的点击
function handleClick() {
  if (isClickable.value) {
    emit('select', props.user.id)
  }
  else if (!props.isSelf && !props.transferState) {
    // 只有在没有进行传输时，才提示无法连接
    // eslint-disable-next-line no-console
    console.log(`无法向 ${props.user.name} 发送文件，因为连接状态是: ${props.user.rtcState}`)
  }
}
// 计算属性，判断状态指示器是否可以点击以重连
const canReconnect = computed(() => {
  const state = props.user.rtcState
  // 未连接、或已断开/失败时，可以点击重连
  return state === 'no-connection' || state === 'failed' || state === 'disconnected' || state === 'closed'
})

function handleStatusClick() {
  if (canReconnect.value) {
    emit('reconnect', props.user.id)
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
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`
  }
  else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  }
  else {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`
  }
}
// 增加一个格式化文件大小的辅助函数
function formatFileSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
</script>

<template>
  <div
    class="user-card group p-4 border rounded-lg flex flex-col shadow transition-all items-center relative dark:border-gray-700"
    :class="{
      // 当可以发起新传输时，显示手型光标和悬浮效果
      'cursor-pointer hover:shadow-md dark:hover:border-gray-500': isClickable,
      // 当不可以发起新传输时，显示默认光标 (不再是 not-allowed)
      'cursor-default': !isClickable,
      'border-green-500 ring-2 ring-green-500 dark:border-green-400 dark:ring-green-400': isSelf,
    }"
    @click="handleClick"
  >
    <!-- 主要内容: 头像和名称 -->
    <div :class="user.avatar" class="text-5xl mb-2 h-16 w-16" />
    <span class="font-semibold truncate" :title="user.name">{{ user.name }} <span v-if="isSelf" class="text-xs text-gray-500 dark:text-gray-400">(你)</span></span>

    <!-- 状态显示区域 (使用 v-if / v-else-if / v-else 控制显示优先级) -->
    <div class="text-xs mt-2 text-center w-full">
      <!-- 1. 优先显示文件传入请求 -->
      <div v-if="incomingRequest" class="p-2 rounded-md bg-blue-100 w-full dark:bg-blue-900">
        <p class="font-semibold mb-1 truncate" :title="incomingRequest.file.name">
          {{ incomingRequest.file.name }}
        </p>
        <p class="text-gray-600 mb-2 dark:text-gray-400">
          {{ formatFileSize(incomingRequest.file.size) }}
        </p>
        <div class="flex gap-2 justify-center">
          <button class="text-xs text-white px-3 py-1 rounded bg-green-500 hover:bg-green-600" @click.stop="emit('accept', user.id)">
            接受
          </button>
          <button class="text-xs text-white px-3 py-1 rounded bg-red-500 hover:bg-red-600" @click.stop="emit('reject', user.id)">
            拒绝
          </button>
        </div>
      </div>

      <!-- 2. 其次显示文件传输进度 -->
      <div v-else-if="transferState" class="w-full">
        <!-- 信息行: 文件名, 大小, 速度 -->
        <div class="mb-1 flex items-baseline justify-between">
          <p class="font-semibold max-w-[60%] truncate" :title="transferState.fileName">
            {{ transferState.fileName }}
          </p>
          <span v-if="transferState.state === 'transferring'" class="text-gray-500 font-mono dark:text-gray-400">
            {{ formatSpeed(transferState.speed) }}
          </span>
          <span v-else class="text-gray-500 dark:text-gray-400">
            {{ formatFileSize(transferState.fileSize) }}
          </span>
        </div>
        <!-- 进度条行 -->
        <div class="rounded-full bg-gray-200 h-2 w-full relative dark:bg-gray-700">
          <div
            class="rounded-full bg-green-500 h-full transition-all duration-300"
            :style="{ width: `${transferState.progress}%` }"
          />
        </div>
        <!-- 状态文本 -->
        <p class="text-gray-500 mt-1 dark:text-gray-400">
          {{ transferState.progress }}% - {{ transferState.state }}
        </p>
      </div>

      <!-- WebRTC 连接状态 (适用于其他用户) -->
      <div
        v-else-if="!isSelf"
        class="flex gap-1 cursor-pointer items-center justify-center"
        :class="[rtcStatusInfo.color, { 'hover:opacity-75': canReconnect }]"
        title="点击以连接/重连"
        @click.stop="handleStatusClick"
      >
        <div :class="rtcStatusInfo.icon" />
        <span>{{ rtcStatusInfo.text }}</span>
      </div>

      <!-- !! 新增: 自己的卡片上显示 NAT 检测按钮 !! -->
      <button
        v-if="isSelf"
        class="text-xs mt-2 px-3 py-1 border rounded dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        @click.stop="emit('detect-nat')"
      >
        <span class="i-carbon-network-4 mr-1" />
        检测我的 NAT 类型
      </button>
    </div>

    <!-- 取消按钮: 悬浮在卡片右上角显示 -->
    <button
      v-if="transferState && (transferState.state === 'transferring' || transferState.state === 'requesting')"
      class="i-carbon-close-outline text-xl text-red-500 opacity-0 cursor-pointer transition-opacity right-2 top-2 absolute hover:text-red-700 group-hover:opacity-100"
      title="取消传输"
      @click.stop="emit('cancel', user.id)"
    />
  </div>
</template>

<style scoped>
.user-card .truncate {
  max-width: 120px;
}
</style>
