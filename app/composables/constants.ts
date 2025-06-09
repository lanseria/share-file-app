// app/composables/constants.ts

export const ICE_SERVERS = [
  { urls: 'stun:stun.hitv.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
]

export const CHUNK_SIZE = 64 * 1024 // 64KB

// 新代码
export function getSignalingServerUrl() {
  const config = useRuntimeConfig()
  return config.public.signalingServerUrl
}
