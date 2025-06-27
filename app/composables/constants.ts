// app/composables/constants.ts

export const ICE_SERVERS = [
  {
    // 提供多个 URI 以增加连接成功率
    urls: [
      // 优先使用加密的 TCP 传输，它在严格防火墙下穿透性更好
      'turns:turn.sharee.top:5349?transport=tcp',
      // 提供默认的 UDP 传输作为备选
      'turns:turn.sharee.top:5349',
      // 明确提供 STUNS URI 也是个好习惯
      'stuns:turn.sharee.top:5349',
    ],
    // 提供用户名和凭证
    username: 'bmc',
    credential: 'yCorbERgiVenSIBlundoGEr',
  },

  // --- 服务器 2: Google 的 STUN 服务器 (作为备用和补充) ---
  {
    urls: 'stun:stun.l.google.com:19302',
  },
]

export const CHUNK_SIZE = 64 * 1024 // 64KB

// 新代码
export function getSignalingServerUrl() {
  const config = useRuntimeConfig()
  return config.public.signalingServerUrl
}
