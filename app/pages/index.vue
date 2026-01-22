<script setup lang="ts">
const router = useRouter()

const posts = [
  {
    title: '欢迎来到我的个人博客',
    date: '2024-01-22',
    summary: '这是我的第一篇博客文章，很高兴你能来到这里。这里将记录我的学习心得、技术分享和生活点滴。',
  },
  {
    title: '关于 WebRTC 技术的学习笔记',
    date: '2024-01-20',
    summary: '最近在研究 WebRTC 技术，这是一种允许浏览器之间进行实时音视频通信和数据传输的强大技术。',
  },
  {
    title: 'Nuxt 4 新特性探索',
    date: '2024-01-18',
    summary: 'Nuxt 4 带来了许多令人兴奋的新特性，包括更好的性能、更简洁的 API 和更强的类型支持。',
  },
]

function createRoom() {
  // 生成4位纯数字ID (0000-9999)
  const newRoomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  router.push(`/room/${newRoomId}`)
}
</script>

<template>
  <div class="min-h-[calc(100vh-100px)] p-6 md:p-10">
    <!-- 顶部简介区域 -->
    <div class="max-w-3xl mx-auto mb-12">
      <div class="flex items-center gap-4 mb-4">
        <div class="i-carbon-user text-4xl" />
        <div>
          <h1 class="text-3xl font-bold">
            你好，我是博主
          </h1>
          <p class="text-gray-500 dark:text-gray-400">
            热爱技术，喜欢分享
          </p>
        </div>
      </div>
      <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
        欢迎来到我的个人博客。在这里，我会分享前端开发、Web 技术以及一些有趣的项目。
        希望我的文章能对你有所帮助，也欢迎交流讨论。
      </p>
    </div>

    <!-- 文章列表 -->
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-2xl font-bold mb-4">
        最新文章
      </h2>
      <div
        v-for="post in posts"
        :key="post.title"
        class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ post.date }}
        </p>
        <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
          {{ post.title }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          {{ post.summary }}
        </p>
      </div>
    </div>
  </div>
</template>
