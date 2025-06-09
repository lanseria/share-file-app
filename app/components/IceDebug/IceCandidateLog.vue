<script setup lang="ts">
interface Props {
  logEntries: IceCandidateLogEntry[]
}

defineProps<Props>()

function formatPriority(p?: number) {
  if (p === undefined)
    return 'N/A'
  // 简单的格式化，您可以根据需要调整
  const type_preference = (p >> 24) & 0xFF
  const local_preference = (p >> 8) & 0xFFFF
  const component_id = p & 0xFF
  return `${type_preference} | ${local_preference} | ${component_id}`
}
</script>

<template>
  <div class="flex-1">
    <h3 class="text-lg font-semibold mb-2">
      ICE Candidate Log
    </h3>
    <div class="text-xs font-mono border rounded max-h-96 overflow-y-auto dark:border-gray-700">
      <table class="text-left w-full table-fixed">
        <thead class="bg-gray-50 top-0 sticky dark:bg-gray-800">
          <tr>
            <th class="p-2 w-[60px]">
              Time
            </th>
            <th class="p-2 w-[50px]">
              Type
            </th>
            <th class="p-2 w-[90px]">
              Protocol
            </th>
            <th class="p-2 w-[120px]">
              Address
            </th>
            <th class="p-2 w-[55px]">
              Port
            </th>
            <th class="p-2 w-[190px]">
              Priority
            </th>
            <th class="p-2">
              URL
            </th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-900">
          <tr v-if="logEntries.length === 0">
            <td colspan="7" class="text-gray-500 p-4 text-center">
              No ICE candidates gathered yet. Change config to start.
            </td>
          </tr>
          <tr v-for="(entry, index) in logEntries" :key="index" class="border-t dark:border-gray-700">
            <td v-if="entry.type === 'done' || entry.type === 'error'" colspan="7" class="p-2" :class="entry.type === 'error' ? 'text-red-500' : 'text-green-500'">
              [{{ entry.time.toFixed(3) }}s] {{ entry.type === 'done' ? 'Gathering complete.' : `Error: ${entry.errorText}` }}
            </td>
            <template v-else>
              <td class="p-2">
                {{ entry.time.toFixed(3) }}s
              </td>
              <td class="p-2">
                {{ entry.type }}
              </td>
              <td class="p-2" :title="entry.protocol">
                {{ entry.protocol }}
              </td>
              <td class="p-2 truncate" :title="entry.address">
                {{ entry.address }}
              </td>
              <td class="p-2">
                {{ entry.port }}
              </td>
              <td class="p-2 truncate" :title="entry.priority?.toString()">
                {{ formatPriority(entry.priority) }}
              </td>
              <td class="p-2 truncate" :title="entry.url">
                {{ entry.url?.replace(/stun:|turn:/, '') }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
