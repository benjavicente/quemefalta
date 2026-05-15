<script setup lang="ts">
const model = defineModel<string>({ default: '' });

defineProps<{
  placeholder?: string;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  enter: [];
}>();
</script>

<template>
  <div class="sec-search-wrap">
    <svg
      class="sec-search-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      v-model="model"
      class="sec-search"
      type="text"
      :aria-label="ariaLabel ?? 'Buscar sección'"
      :placeholder="placeholder ?? 'Buscar sección... (ej: México, MEX)'"
      autocomplete="off"
      @keydown.enter="emit('enter')"
    />
    <button
      v-if="model"
      type="button"
      class="sec-search-clear"
      aria-label="Limpiar búsqueda"
      @click="model = ''"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.sec-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.sec-search-icon {
  position: absolute;
  left: 12px;
  color: rgba(246, 241, 225, 0.45);
  pointer-events: none;
}
.sec-search {
  width: 100%;
  padding: 10px 36px 10px 34px;
  font-family: inherit;
  font-size: 13px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk);
  outline: none;
  box-sizing: border-box;
}
.sec-search::placeholder {
  color: rgba(246, 241, 225, 0.35);
}
.sec-search:focus {
  border-color: var(--gold);
  background: rgba(246, 241, 225, 0.06);
}
.sec-search:focus + .sec-search-icon,
.sec-search-wrap:focus-within .sec-search-icon {
  color: var(--gold);
}
.sec-search-clear {
  position: absolute;
  right: 6px;
  width: 26px;
  height: 26px;
  background: transparent;
  border: none;
  color: rgba(246, 241, 225, 0.55);
  font-size: 20px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.sec-search-clear:hover {
  color: var(--chalk);
  background: rgba(246, 241, 225, 0.06);
}
</style>
