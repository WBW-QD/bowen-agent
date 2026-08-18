<script setup>
// 通用大图查看弹窗：全屏遮罩，点击任意处关闭
defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '' },
})

const open = defineModel('open', { type: Boolean, default: false })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="image-viewer" @click="open = false">
      <img :src="src" :alt="alt" />
    </div>
  </Teleport>
</template>

<style scoped>
.image-viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.82);
  display: grid;
  place-items: center;
  cursor: zoom-out;
  padding: 24px;
}

.image-viewer img {
  max-width: min(70vw, 420px);
  max-height: 70vh;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
</style>
