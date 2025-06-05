// middleware/redirectToRoom.global.ts
import { v4 as uuidv4 } from 'uuid'

export default defineNuxtRouteMiddleware((to, from) => {
  // 检查是否是首次访问根路径，或者直接从外部访问根路径
  // 避免在房间内刷新页面时，如果 from 是 undefined，也重新生成
  // to.name === 'index' 是一个更可靠的判断是否为首页的方式 (如果你的首页路由名称是 'index')
  // 确保你的首页路由的 name 是 'index' (通常 Nuxt 自动生成 pages/index.vue 的路由 name 为 'index')
  if (to.name === 'index' && to.path === '/') {
    const newRoomId = uuidv4()
    // 使用 navigateTo 进行路由跳转，这是 Nuxt 3 推荐的方式
    return navigateTo(`/room/${newRoomId}`, { replace: true }) // replace: true 避免用户可以回退到空白的首页
  }
})