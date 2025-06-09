export const ICE_SERVERS = [
  { urls: 'stun:stun.hitv.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
]

export const CHUNK_SIZE = 64 * 1024 // 64KB

export const SIGNALING_SERVER_URL = import.meta.env.DEV ? 'ws://localhost:8080' : 'wss://lishi.rengshuai.com'
// export const SIGNALING_SERVER_URL = 'ws://111.231.0.12:3000'
