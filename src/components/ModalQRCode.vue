<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">ETH-20</h3>
            <button class="modal-close" @click="closeModal" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="qr-container">
              <canvas ref="canvasRef" class="qr-canvas"></canvas>
            </div>
            <div class="text-value">{{ currentText }}</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import QRCode from 'qrcode'

const isVisible = ref(false)
const currentText = ref('')
const canvasRef = ref<HTMLCanvasElement | null>(null)

const generateQRCode = async (text: string): Promise<void> => {
  if (!canvasRef.value || !text) return

  await nextTick()
  const canvas = canvasRef.value
  await QRCode.toCanvas(canvas, text, { width: 200, margin: 0, errorCorrectionLevel: 'M' })
}

const show = async (text: string): Promise<void> => {
  if (!text || text.trim() === '') {
    console.warn('Cannot show modal with empty text')
    return
  }

  currentText.value = text
  isVisible.value = true

  await nextTick()
  await generateQRCode(text)
}

const closeModal = (): void => {
  isVisible.value = false
  currentText.value = ''
}

watch(currentText, (newText) => {
  if (newText && isVisible.value) {
    generateQRCode(newText)
  }
})

defineExpose({
  show
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(4, 6, 8, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--color10);
  border-radius: 1rem;
  box-shadow: var(--shadow);
  max-width: 450px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  border: var(--border-thickness) solid var(--color40);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color40);
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  font-family: var(--heading);
  color: var(--color90);
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  color: var(--color70);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background-color: var(--color30);
  color: var(--color90);
}

.modal-body {
  padding: 24px;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.qr-container canvas {
  padding: 1rem;
  background-color: #fff;
  border-radius: 0.5rem;
}

.text-value {
  font-family: var(--mono);
  font-size: 0.9rem;
  color: var(--color90);
  word-break: break-all;
  line-height: 1.5;
  max-height: 100px;
  overflow-y: auto;
  background: var(--color20);
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color30);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
