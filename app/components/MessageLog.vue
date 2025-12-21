<script setup lang="ts">
// app/components/MessageLog.vue

interface Props {
  messages: MessageLog[]
}

defineProps<Props>()
</script>

<template>
  <div class="mt-4 md:mt-8">
    <h3 class="text-lg font-semibold mb-2">
      信令消息日志:
    </h3>
    <div class="text-sm p-2 text-left border rounded bg-gray-50 max-h-96 overflow-y-auto dark:border-gray-700 dark:bg-gray-800">
      <div v-for="(msg, index) in messages" :key="index" class="font-mono mb-1">
        <span
          :class="{
            'text-green-600 dark:text-green-400': msg.type === 'received',
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
</template>
