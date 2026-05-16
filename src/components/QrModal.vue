<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import QRCode from 'qrcode';

const props = defineProps<{
  url: string;
  username: string;
}>();

defineEmits<{
  close: [];
}>();

const svgRef = ref<HTMLElement | null>(null);
const ready = ref(false);
const error = ref<string | null>(null);

async function render() {
  try {
    error.value = null;
    ready.value = false;
    const svg = await QRCode.toString(props.url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    if (svgRef.value) {
      svgRef.value.innerHTML = svg;
    }
    ready.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo generar el QR';
  }
}

onMounted(render);
watch(() => props.url, render);
</script>

<template>
  <div class="modal-bg qr-bg" @click="$emit('close')" @keydown.escape="$emit('close')">
    <div class="qr-card" @click.stop>
      <button class="qr-close" aria-label="Cerrar" @click="$emit('close')">×</button>
      <div class="qr-username">@{{ username }}</div>
      <div class="qr-hint">Escanea con la cámara para abrir mi álbum</div>

      <div v-if="error" class="qr-error" role="alert">{{ error }}</div>
      <div
        v-show="!error && ready"
        class="qr-svg-wrap"
        role="img"
        :aria-label="`Código QR para ${url}`"
      >
        <div ref="svgRef" />
      </div>
      <div v-if="!error && !ready" class="qr-loading">Generando…</div>

      <div class="qr-url">{{ url.replace(/^https?:\/\//, '') }}</div>

      <button class="qr-cta" @click="$emit('close')">Listo</button>
    </div>
  </div>
</template>

<style scoped>
.qr-bg {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
  padding-top: calc(20px + env(safe-area-inset-top));
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}
.qr-card {
  position: relative;
  background: #ffffff;
  color: #0a3d2e;
  border-radius: 18px;
  padding: 22px 22px 18px;
  max-width: min(92vw, 420px);
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
}
.qr-close {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: rgba(10, 61, 46, 0.45);
  cursor: pointer;
  padding: 4px 10px;
}
.qr-close:hover {
  color: var(--pitch-deep, #0a3d2e);
}
.qr-username {
  font-family: var(--mono, monospace);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #0a3d2e;
}
.qr-hint {
  font-size: 11px;
  color: rgba(10, 61, 46, 0.65);
  letter-spacing: 0.04em;
  text-align: center;
  margin-bottom: 4px;
}
.qr-svg-wrap {
  width: min(70vw, 320px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border-radius: 8px;
  padding: 4px;
}
.qr-svg-wrap :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.qr-loading,
.qr-error {
  width: min(70vw, 320px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(10, 61, 46, 0.55);
  background: rgba(10, 61, 46, 0.04);
  border-radius: 8px;
}
.qr-error {
  color: #c44a2c;
}
.qr-url {
  font-family: var(--mono, monospace);
  font-size: 11px;
  color: rgba(10, 61, 46, 0.7);
  letter-spacing: 0.03em;
  word-break: break-all;
  text-align: center;
}
.qr-cta {
  margin-top: 6px;
  width: 100%;
  padding: 12px;
  background: #0a3d2e;
  color: #f6f1e1;
  border: none;
  border-radius: 10px;
  font-family: inherit;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.qr-cta:hover {
  background: #062318;
}
</style>
