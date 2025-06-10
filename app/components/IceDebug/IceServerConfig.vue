<script setup lang="ts">
// app/components/IceDebug/IceServerConfig.vue
const props = defineProps<{
  modelValue: RTCIceServer[]
  iceTransportPolicy: 'all' | 'relay'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RTCIceServer[]): void
  (e: 'update:iceTransportPolicy', value: 'all' | 'relay'): void
}>()

const newServer = ref<RTCIceServer>({ urls: '' })
const editIndex = ref<number | null>(null)

function addOrUpdateServer() {
  if (!newServer.value.urls)
    return
  const servers = [...props.modelValue]
  if (editIndex.value !== null) {
    // 更新
    servers[editIndex.value] = newServer.value
  }
  else {
    // 添加
    servers.push(newServer.value)
  }
  emit('update:modelValue', servers)
  resetForm()
}

function editServer(index: number) {
  editIndex.value = index
  // 深拷贝以避免直接修改 prop
  newServer.value = JSON.parse(JSON.stringify(props.modelValue[index]))
}

function removeServer(index: number) {
  const servers = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', servers)
}

function resetForm() {
  newServer.value = { urls: '' }
  editIndex.value = null
}

const localIceTransportPolicy = computed({
  get: () => props.iceTransportPolicy,
  set: val => emit('update:iceTransportPolicy', val),
})
</script>

<template>
  <div class="flex-shrink-0 w-full md:pr-4 md:w-1/3">
    <h3 class="text-lg font-semibold mb-2">
      ICE Configuration
    </h3>
    <!-- ICE Servers List -->
    <div class="mb-4 space-y-2">
      <div v-for="(server, index) in modelValue" :key="index" class="text-sm p-2 border rounded flex items-center justify-between dark:border-gray-700">
        <span class="truncate" :title="server.urls.toString()">{{ server.urls }}</span>
        <div class="ml-2 flex gap-2">
          <button class="i-carbon-edit text-blue-500 hover:text-blue-700" @click="editServer(index)" />
          <button class="i-carbon-trash-can text-red-500 hover:text-red-700" @click="removeServer(index)" />
        </div>
      </div>
      <p v-if="modelValue.length === 0" class="text-xs text-gray-500">
        Using default STUN servers.
      </p>
    </div>

    <!-- Add/Edit Form -->
    <div class="mb-4 p-3 border rounded space-y-2 dark:border-gray-700">
      <h4 class="text-sm font-semibold">
        {{ editIndex !== null ? 'Edit Server' : 'Add Server' }}
      </h4>
      <div>
        <label class="text-xs">STUN/TURN URI(s)</label>
        <input v-model="newServer.urls" type="text" placeholder="stun:stun.example.com" class="text-sm p-1 border rounded w-full dark:border-gray-600 dark:bg-gray-800">
      </div>
      <div>
        <label class="text-xs">TURN Username</label>
        <input v-model="newServer.username" type="text" class="text-sm p-1 border rounded w-full dark:border-gray-600 dark:bg-gray-800">
      </div>
      <div>
        <label class="text-xs">TURN Password</label>
        <input v-model="newServer.credential" type="password" class="text-sm p-1 border rounded w-full dark:border-gray-600 dark:bg-gray-800">
      </div>
      <div class="pt-2 flex gap-2">
        <button class="text-sm text-white px-3 py-1 rounded bg-blue-500 hover:bg-blue-600" @click="addOrUpdateServer">
          {{ editIndex !== null ? 'Save' : 'Add' }}
        </button>
        <button v-if="editIndex !== null" class="text-sm px-3 py-1 border rounded dark:border-gray-600" @click="resetForm">
          Cancel
        </button>
      </div>
    </div>

    <!-- ICE Options -->
    <div>
      <h4 class="text-sm font-semibold mb-1">
        ICE Options
      </h4>
      <label for="ice-policy" class="text-xs mr-2">iceTransportPolicy:</label>
      <select id="ice-policy" v-model="localIceTransportPolicy" class="text-sm p-1 border rounded dark:border-gray-600 dark:bg-gray-800">
        <option value="all">
          all
        </option>
        <option value="relay">
          relay
        </option>
      </select>
    </div>
  </div>
</template>
