// app/composables/useNatTypeDetector.ts

export type NatType =
  | 'Unknown'
  | 'Detecting...'
  | 'Cone NAT' // 包含 Full Cone, Restricted Cone, Port Restricted Cone 的统称
  | 'Symmetric NAT'
  | 'Blocked' // 无法连接到 STUN 服务器
  | 'Public IP' // 无需 NAT

// 注意：需要提供多个 STUN 服务器才能有效检测对称型 NAT
const NAT_TEST_STUN_SERVERS = ICE_SERVERS

export function useNatTypeDetector() {
  const natType = ref<NatType>('Unknown')
  let pc: RTCPeerConnection | null = null

  function detect() {
    if (natType.value === 'Detecting...') {
      // eslint-disable-next-line no-console
      console.log('NAT detection is already in progress.')
      return
    }

    // 立即设置状态为 "Detecting..."
    natType.value = 'Detecting...'

    // 使用临时的 RTCPeerConnection 来收集 ICE 候选
    // 我们不需要真正建立连接，只需要触发 onicecandidate
    try {
      pc = new RTCPeerConnection({ iceServers: NAT_TEST_STUN_SERVERS })
    }
    catch (e) {
      console.error('Failed to create RTCPeerConnection for NAT detection:', e)
      natType.value = 'Blocked'
      return
    }

    const srflxCandidates: RTCIceCandidate[] = []
    const hostCandidates: RTCIceCandidate[] = []

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (event.candidate.type === 'srflx') {
          srflxCandidates.push(event.candidate)
        }
        else if (event.candidate.type === 'host') {
          hostCandidates.push(event.candidate)
        }
      }
    }

    // ice gathering state change to complete
    pc.onicegatheringstatechange = () => {
      if (pc?.iceGatheringState === 'complete') {
        analyseCandidates()
        // 清理
        if (pc) {
          pc.close()
          pc = null
        }
      }
    }

    function analyseCandidates() {
      if (srflxCandidates.length === 0 && hostCandidates.length === 0) {
        natType.value = 'Blocked' // 如果完全没候选，就是 Blocked
        return
      }
      // 检查是否有公网 IP（host candidate 的 IP 和 srflx candidate 的 IP 相同）
      const hasPublicIp = hostCandidates.some(hc => srflxCandidates.some(sc => sc.address === hc.address))
      if (hasPublicIp) {
        natType.value = 'Public IP'
        return
      }

      // 检查是否为对称型 NAT
      const publicPorts = new Set(srflxCandidates.map(c => c.port))
      if (publicPorts.size > 1) {
        // 从不同 STUN 服务器获取到了不同的端口映射，这是对称型 NAT 的典型特征
        natType.value = 'Symmetric NAT'
      }
      else {
        // 所有 STUN 服务器返回的端口映射都一样，是锥型 NAT
        natType.value = 'Cone NAT'
      }
      // eslint-disable-next-line no-console
      console.log(`NAT type detected: ${natType.value}`)
    }

    // 创建一个假的 DataChannel 来触发 ICE gathering
    pc.createDataChannel('nat-test')
    pc.createOffer()
      .then(offer => pc!.setLocalDescription(offer))
      .catch((e) => {
        console.error('Error creating offer for NAT detection:', e)
        natType.value = 'Blocked'
      })
  }

  return {
    natType,
    detect,
  }
}
