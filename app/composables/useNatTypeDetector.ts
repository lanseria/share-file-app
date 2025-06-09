// app/composables/useNatTypeDetector.ts

// 沿用 useWebRtcManager 的思路
export type IceCandidateHandler = (entry: any) => void

export type NatType =
  | 'Unknown'
  | 'Detecting...'
  | 'Cone NAT'
  | 'Symmetric NAT'
  | 'Blocked'
  | 'Public IP'

export function useNatTypeDetector() {
  const natType = ref<NatType>('Unknown')
  let pc: RTCPeerConnection | null = null
  let iceCandidateHandler: IceCandidateHandler | null = null
  let gatheringStartTime: number | null = null

  // 接收外部的 ICE 配置和处理器
  function detect(configuration: RTCConfiguration) {
    if (natType.value === 'Detecting...') {
      // eslint-disable-next-line no-console
      console.log('NAT detection is already in progress.')
      return
    }

    natType.value = 'Detecting...'
    gatheringStartTime = performance.now()

    try {
      pc = new RTCPeerConnection(configuration)
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
        // 报告日志
        const time = (performance.now() - (gatheringStartTime || 0)) / 1000
        // eslint-disable-next-line no-console
        console.log(event.candidate)
        iceCandidateHandler?.({
          time,
          type: event.candidate.type,
          foundation: event.candidate.foundation,
          protocol: event.candidate.protocol,
          address: event.candidate.address,
          port: event.candidate.port,
          priority: event.candidate.priority,
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore
          url: event.candidate.url, // 简化 URL 解析
        })

        // 收集用于分析的候选者
        if (event.candidate.type === 'srflx') {
          srflxCandidates.push(event.candidate)
        }
        else if (event.candidate.type === 'host') {
          hostCandidates.push(event.candidate)
        }
      }
    }

    pc.onicegatheringstatechange = () => {
      if (pc?.iceGatheringState === 'complete') {
        const time = (performance.now() - (gatheringStartTime || 0)) / 1000
        iceCandidateHandler?.({ type: 'done', time })
        analyseCandidates()
        // 清理
        if (pc) {
          pc.close()
          pc = null
        }
      }
    }

    pc.onicecandidateerror = (event) => {
      const time = (performance.now() - (gatheringStartTime || 0)) / 1000
      iceCandidateHandler?.({
        type: 'error',
        time,
        errorText: `Code ${event.errorCode}: ${event.errorText}`,
      })
      natType.value = 'Blocked'
    }

    function analyseCandidates() {
      if (srflxCandidates.length === 0) {
        natType.value = 'Blocked'
        return
      }

      const hasPublicIp = hostCandidates.some(hc => srflxCandidates.some(sc => sc.address === hc.address))
      if (hasPublicIp) {
        natType.value = 'Public IP'
        return
      }

      const publicPorts = new Set(srflxCandidates.map(c => c.port))
      if (publicPorts.size > 1) {
        natType.value = 'Symmetric NAT'
      }
      else {
        natType.value = 'Cone NAT'
      }
      // eslint-disable-next-line no-console
      console.log(`NAT type detected: ${natType.value}`)
    }

    pc.createDataChannel('nat-test')
    pc.createOffer()
      .then(offer => pc!.setLocalDescription(offer))
      .catch((e) => {
        console.error('Error creating offer for NAT detection:', e)
        natType.value = 'Blocked'
      })
  }

  // 用于外部注入日志处理器的方法
  function onIceCandidate(handler: IceCandidateHandler) {
    iceCandidateHandler = handler
  }

  return {
    natType,
    detect,
    onIceCandidate,
  }
}
