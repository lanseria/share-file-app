<script setup lang="ts">
// app/components/UserCard.vue
import type { User } from '~/composables/useWebSocketSignaling'

interface Props {
  user: User
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
