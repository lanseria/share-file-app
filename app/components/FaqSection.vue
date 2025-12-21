<!-- app/components/FaqSection.vue -->
<script setup lang="ts">
// No script logic needed for this component
</script>

<template>
  <div class="my-4 text-left space-y-4 md:my-8">
    <!-- Section 1: NAT and Connection Issues -->
    <details class="group p-4 border rounded-lg dark:border-gray-700">
      <summary class="font-semibold cursor-pointer select-none group-open:mb-4">
        <div class="flex gap-2 items-center">
          <span class="i-carbon-help text-xl" />
          <span>为什么我和对方连接不上？(NAT 类型说明)</span>
          <span class="i-carbon-chevron-down ml-auto transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div class="text-gray-700 max-w-none prose prose-sm dark:text-gray-300 dark:prose-invert">
        <p>
          P2P 连接的成功率很大程度上取决于您和对方所处的网络环境，即 <strong>NAT (网络地址转换)</strong> 类型。您可以将 NAT 想象成您家庭或公司网络的“前台”，它决定了外部设备如何与您“通话”。
        </p>
        <p>
          您可以在自己卡片上点击 <strong>“检测我的 NAT 类型”</strong> 按钮（会跳转到第三方网站）来了解自己的网络情况。常见的连接场景如下：
        </p>
        <ul>
          <li>
            <strong>✅ 场景一 (总能成功): 任意一方为开放网络 (Full Cone NAT / NAT 1)</strong>
            <br>
            如果你们中至少有一个人的网络是“开放”的，就像拥有一个公共地址，那么 P2P 连接几乎总能建立成功。
          </li>
          <li>
            <strong>✅ 场景二 (大概率成功): 双方都是普通受限网络 (Restricted Cone NAT / Port Restricted Cone NAT / NAT 2 & 3)</strong>
            <br>
            这是最常见的情况（如家庭路由器）。本应用通过信令服务器的“打洞”技术，可以很大概率上帮助你们建立直接连接。
          </li>
          <li>
            <strong>❌ 场景三 (几乎无法直连): 双方都是严格网络 (Symmetric NAT / NAT 4)</strong>
            <br>
            这是最严格的网络类型（常见于部分公司网络或 4G/5G 热点）。如果双方都是这种类型，P2P“打洞”会非常困难，基本无法建立直接连接。
          </li>
        </ul>
        <p class="p-2 rounded bg-yellow-100 dark:bg-yellow-900/30">
          <strong>终极解决方案 (Relay / 中继):</strong>
          <br>
          对于场景三，唯一的办法是通过一台名为 <strong>TURN</strong> 的中继服务器来转发所有数据。这可以保证连接成功，但速度会变慢，因为它不再是“点对点”直连。您可以在下方的 <strong>"ICE Configuration"</strong> 中手动添加一个可用的 TURN 服务器地址来启用此功能。
        </p>
      </div>
    </details>

    <!-- Section 2: High-Speed Transfer Guide -->
    <details class="group p-4 border rounded-lg dark:border-gray-700">
      <summary class="font-semibold cursor-pointer select-none group-open:mb-4">
        <div class="flex gap-2 items-center">
          <span class="i-carbon-flash text-xl" />
          <span>如何获得最快的文件传输速度？</span>
          <span class="i-carbon-chevron-down ml-auto transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div class="text-gray-700 max-w-none prose prose-sm dark:text-gray-300 dark:prose-invert">
        <p>
          P2P 的魅力就在于其惊人的直连速度。要获得“隔空投送 (AirDrop)”般的体验，请尝试以下方法：
        </p>
        <ul>
          <li>
            <strong class="flex gap-1 items-center"><span class="i-carbon-wifi text-lg" /> 在同一个局域网内传输 (效果最佳)</strong>
            <br>
            当您和对方连接到<strong>同一个 Wi-Fi 或路由器</strong>时，数据会直接在局域网内传输，不经过外网，速度最快、延迟最低。这是手机和电脑互传文件的理想方式。
          </li>
          <li>
            <strong class="flex gap-1 items-center"><span class="i-carbon-ethernet text-lg" /> 使用有线网络连接</strong>
            <br>
            如果条件允许，使用有线网络（网线）通常比 Wi-Fi 更稳定、干扰更少，有助于维持高速传输。
          </li>
          <li>
            <strong class="flex gap-1 items-center"><span class="i-carbon-network-4 text-lg" /> 拥有良好的网络环境 (NAT 类型)</strong>
            <br>
            如上所述，一个开放或限制较少的 NAT 类型更容易建立高质量的 P2P 直连，从而获得更好的速度。
          </li>
          <li>
            <strong class="flex gap-1 items-center"><span class="i-carbon-cloud-satellite text-lg" /> 避免使用代理或部分 VPN</strong>
            <br>
            某些网络代理或 VPN 会阻碍 P2P 连接的建立，或强制数据绕行，导致速度变慢。如果遇到连接问题，可以尝试关闭它们。
          </li>
        </ul>
      </div>
    </details>
  </div>
</template>

<style scoped>
/* UnoCSS 'prose' 插件会处理大部分样式，但我们可以微调 */
details summary {
  list-style: none; /* 移除默认的三角箭头 */
}
details summary::-webkit-details-marker {
  display: none;
}
</style>
