// app/composables/constants.ts

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
]

export const CHUNK_SIZE = 64 * 1024 // 64KB

// 新代码
export function getSignalingServerUrl() {
  const config = useRuntimeConfig()
  return config.public.signalingServerUrl
}
