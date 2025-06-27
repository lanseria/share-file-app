<script setup lang="ts">
// app/components/IceDebug/index.vue
import IceCandidateLog from './IceCandidateLog.vue'
// import IceServerConfig from './IceServerConfig.vue'

// 定义与子组件相同的 Props 和 Emits，用于数据透传
defineProps<{
  iceServers: RTCIceServer[]
  iceTransportPolicy: 'all' | 'relay'
  iceCandidateLog: any[] // 使用 any 避免类型导入
}>()

defineEmits<{
  (e: 'update:iceServers', value: RTCIceServer[]): void
  (e: 'update:iceTransportPolicy', value: 'all' | 'relay'): void
}>()
</script>

<template>
  <div class="my-8">
    <div class="p-4 border rounded dark:border-gray-700">
      <div class="flex flex-col md:flex-row">
        <!-- <IceServerConfig
          :model-value="iceServers"
          :ice-transport-policy="iceTransportPolicy"
          @update:model-value="$emit('update:iceServers', $event)"
          @update:ice-transport-policy="$emit('update:iceTransportPolicy', $event)"
        /> -->
        <IceCandidateLog :log-entries="iceCandidateLog" />
      </div>
      <p class="text-xs text-yellow-600 mt-4 dark:text-yellow-400">
        <span class="i-carbon-warning-alt inline-block" />
        注意: 更改任何 ICE 配置都会重置所有现有连接，并使用新配置重新进行连接和候选者收集。
      </p>
    </div>
  </div>
</template>
