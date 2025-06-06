<script setup lang="ts">
// app/components/UserGrid.vue

interface Props {
  users: UserWithStatus[]
  myClientId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select-user', userId: string): void
}>()

function handleUserSelect(userId: string) {
  emit('select-user', userId)
}
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
        @select="handleUserSelect"
      />
    </div>
    <p v-else class="text-gray-500 dark:text-gray-400">
      房间内还没有其他用户。
    </p>
  </div>
</template>
