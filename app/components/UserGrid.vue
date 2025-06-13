<script setup lang="ts">
// app/components/UserGrid.vue

interface Props {
  users: UserWithStatus[]
  myClientId: string | null
  transferStates: Map<string, TransferProgress>
  incomingRequests: Map<string, TransferRequest>
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select-user', userId: string): void
  (e: 'accept-request', userId: string): void
  (e: 'reject-request', userId: string): void
  (e: 'cancel-transfer', userId: string): void
  (e: 'detect-nat'): void // 新增
}>()
</script>

<template>
  <div class="mt-8">
    <h2 class="text-xl mb-2">
      房间内的用户 ({{ users.length }}):
    </h2>
    <div v-if="users.length > 0" class="gap-4 grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3">
      <UserCard
        v-for="user in users"
        :key="user.id"
        :user="user"
        :is-self="user.id === myClientId"
        :transfer-state="transferStates.get(user.id)"
        :incoming-request="incomingRequests.get(user.id)"
        @select="emit('select-user', $event)"
        @accept="emit('accept-request', $event)"
        @reject="emit('reject-request', $event)"
        @cancel="emit('cancel-transfer', $event)"
        @detect-nat="emit('detect-nat')"
      />
    </div>
    <p v-else class="text-gray-500 dark:text-gray-400">
      房间内还没有其他用户。
    </p>
  </div>
</template>
