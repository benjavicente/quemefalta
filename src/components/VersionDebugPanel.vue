<script setup lang="ts">
import { debugMode, debugLastResult, triggerCheckNow } from '@/lib/versionCheck';

const buildId = __BUILD_ID__;
</script>

<template>
  <div v-if="debugMode" class="vdbg">
    <div class="vdbg-title">VERSION DEBUG</div>
    <div class="vdbg-build">BUILD: {{ buildId }}</div>
    <button class="vdbg-btn" @click="triggerCheckNow">CHECK NOW</button>
    <div class="vdbg-result">{{ debugLastResult }}</div>
  </div>
</template>

<style scoped>
.vdbg {
  position: fixed;
  top: calc(8px + env(safe-area-inset-top));
  right: 8px;
  background: black;
  color: #0f0;
  padding: 10px 12px;
  border: 1px solid #0f0;
  border-radius: 8px;
  font-family: var(--mono, monospace);
  font-size: 11px;
  z-index: 9999;
  max-width: 280px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
}
.vdbg-title {
  font-weight: 800;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}
.vdbg-build {
  opacity: 0.7;
  margin-bottom: 8px;
  word-break: break-all;
}
.vdbg-btn {
  background: #0f0;
  color: black;
  border: none;
  font-family: inherit;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  margin-bottom: 8px;
}
.vdbg-result {
  word-break: break-word;
  white-space: pre-wrap;
  opacity: 0.9;
}
</style>
