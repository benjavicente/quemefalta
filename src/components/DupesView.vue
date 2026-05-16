<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ALBUM_SECTIONS, codeForSticker } from '@/lib/albumData';
import { useStickers } from '@/composables/useStickers';
import SectionSearch from '@/components/SectionSearch.vue';
import { matchesSection } from '@/lib/searchSections';

const emit = defineEmits<{
  openDetail: [stickerNumber: number];
  copied: [message: string];
}>();

const { stickers, stats, adjustDupes } = useStickers();

const searchQuery = ref('');
const showAllOwned = ref(false);

// "Visible set" sticky por mount: arrancamos con los que tienen dupes>0 al
// entrar a la vista, y agregamos cualquiera que adquiera dupes>0 durante la
// sesión. NUNCA removemos: si el usuario baja a 0 con el "−", el item queda
// grisado para poder volver a sumar sin recargar. Al recargar la vista, el
// set se reconstruye y los que están en 0 desaparecen.
const visibleSet = ref<Set<number>>(new Set());
watch(
  stickers,
  (current) => {
    let mutated = false;
    const next = visibleSet.value;
    for (const numStr in current) {
      const num = Number(numStr);
      const s = current[num];
      if (s?.owned && s.dupes > 0 && !next.has(num)) {
        next.add(num);
        mutated = true;
      }
    }
    if (mutated) visibleSet.value = new Set(next);
  },
  { immediate: true, deep: true },
);

const dupesList = computed(() => {
  const out: { num: number; section: string; sectionId: string; count: number; note: string }[] =
    [];
  for (const sec of ALBUM_SECTIONS) {
    if (!matchesSection(sec, searchQuery.value)) continue;
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      const s = stickers.value[num];
      const include = showAllOwned.value ? s?.owned === true : visibleSet.value.has(num);
      if (!include) continue;
      out.push({
        num,
        section: sec.name,
        sectionId: sec.id,
        count: s?.dupes ?? 0,
        note: s?.note ?? '',
      });
    }
  }
  return out.sort((a, b) => a.num - b.num);
});

const hasShowable = computed(() =>
  showAllOwned.value ? stats.value.owned > 0 : visibleSet.value.size > 0,
);

function copyDupes() {
  const lines: string[] = [`Tengo ${stats.value.dupes} láminas repetidas para cambiar:`];
  const bySection = new Map<string, { code: string; count: number }[]>();
  for (const d of dupesList.value) {
    if (d.count <= 0) continue; // items grisados (bajaron a 0 en sesión): no copiar
    if (!bySection.has(d.section)) bySection.set(d.section, []);
    bySection.get(d.section)!.push({ code: codeForSticker(d.num), count: d.count });
  }
  for (const [section, items] of bySection) {
    lines.push(
      `\n${section}: ${items
        .map((i) => (i.count > 1 ? `${i.code} (+${i.count})` : i.code))
        .join(', ')}`,
    );
  }
  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).then(
    () => emit('copied', '¡Lista copiada al portapapeles!'),
    () => alert('No se pudo copiar. Selecciona manualmente.'),
  );
}
</script>

<template>
  <div class="list-view">
    <div class="list-head">
      <div class="list-head-text">
        <h2>TIENES {{ stats.dupes }} REPETIDAS</h2>
        <p>Listas para cambiar. Toca una para editar cantidad o notas.</p>
      </div>
      <button v-if="dupesList.length > 0" class="copy-btn" @click="copyDupes">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        Copiar
      </button>
    </div>
    <div v-if="stats.dupes > 0 || stats.owned > 0" class="dupes-controls">
      <SectionSearch v-model="searchQuery" class="dupes-search" />
      <button
        v-if="stats.owned > 0"
        type="button"
        class="show-all-toggle"
        :class="{ 'show-all-on': showAllOwned }"
        :aria-pressed="showAllOwned"
        @click="showAllOwned = !showAllOwned"
      >
        {{ showAllOwned ? '✓ Mostrando todas las que tengo' : 'Mostrar todas las que tengo' }}
      </button>
    </div>

    <div v-if="hasShowable && dupesList.length === 0" class="empty-search">
      Sin resultados en "{{ searchQuery }}".
    </div>

    <div v-else-if="dupesList.length === 0" class="empty empty-dupes">
      <div class="empty-stack">
        <div class="empty-tile empty-tile-back-l" />
        <div class="empty-tile empty-tile-back-r" />
        <div class="empty-tile empty-tile-front">
          <span class="empty-tile-q">?</span>
        </div>
        <div class="empty-sparkle-l">✦</div>
        <div class="empty-sparkle-r">✦</div>
      </div>
      <div class="empty-title">NO TIENES REPETIDAS</div>
      <div class="empty-sub">
        Cuando marques cantidades en el álbum aparecerán aquí, listas para cambiar.
      </div>
    </div>
    <div v-else class="dupes-list">
      <div
        v-for="d in dupesList"
        :key="d.num"
        class="dupe-item"
        :class="{ 'dupe-item-empty': d.count === 0 }"
      >
        <button
          type="button"
          class="dupe-main-btn"
          :aria-label="`Editar ${codeForSticker(d.num)}`"
          @click="emit('openDetail', d.num)"
        >
          <div class="dupe-num">{{ codeForSticker(d.num) }}</div>
          <div class="dupe-info">
            <div class="dupe-section">{{ d.section }}</div>
            <div v-if="d.note" class="dupe-note">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="flex-shrink: 0"
              >
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {{ d.note }}
            </div>
          </div>
        </button>
        <div
          class="dupe-stepper"
          role="group"
          :aria-label="`Ajustar repetidas de ${codeForSticker(d.num)}`"
        >
          <button
            type="button"
            class="dupe-step-btn"
            :disabled="d.count <= 0"
            aria-label="Quitar una repetida"
            @click.stop="adjustDupes(d.num, -1)"
          >
            −
          </button>
          <span class="dupe-count">+{{ d.count }}</span>
          <button
            type="button"
            class="dupe-step-btn"
            aria-label="Agregar una repetida"
            @click.stop="adjustDupes(d.num, 1)"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-view {
  padding: clamp(14px, 3vw, 28px);
}
.list-head {
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.list-head-text h2 {
  font-family: var(--display);
  font-size: clamp(22px, 4vw, 36px);
  letter-spacing: 0.02em;
  line-height: 1;
  margin: 0 0 6px;
}
.list-head-text p {
  font-size: 11px;
  color: rgba(246, 241, 225, 0.6);
  line-height: 1.45;
  margin: 0;
}
.copy-btn {
  flex-shrink: 0;
  padding: 10px 14px;
  background: var(--gold);
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
}
.copy-btn:hover {
  background: var(--gold-deep);
}

.dupes-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.dupes-search {
  margin-bottom: 0;
}
.show-all-toggle {
  align-self: flex-start;
  background: transparent;
  border: 1px solid rgba(246, 241, 225, 0.18);
  color: rgba(246, 241, 225, 0.65);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 7px 12px;
  border-radius: 100px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}
.show-all-toggle:hover {
  border-color: rgba(246, 241, 225, 0.32);
  color: rgba(246, 241, 225, 0.85);
}
.show-all-toggle.show-all-on {
  background: rgba(232, 179, 65, 0.14);
  border-color: var(--gold);
  color: var(--gold);
}
.empty-search {
  text-align: center;
  padding: 30px 20px;
  font-size: 12px;
  color: rgba(246, 241, 225, 0.5);
  font-style: italic;
}
.dupes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dupe-item {
  display: flex;
  align-items: stretch;
  background: rgba(246, 241, 225, 0.025);
  border: 1px solid var(--line);
  border-left: 3px solid var(--coral);
  border-radius: 6px;
  overflow: hidden;
  transition: opacity 0.25s;
}
.dupe-item-empty {
  opacity: 0.45;
  border-left-color: rgba(246, 241, 225, 0.18);
}
.dupe-main-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  background: transparent;
  border: none;
  text-align: left;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
}
.dupe-main-btn:hover {
  background: rgba(246, 241, 225, 0.05);
}
.dupe-num {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--gold);
  line-height: 1;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.dupe-info {
  min-width: 0;
}
.dupe-section {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dupe-note {
  font-size: 10px;
  color: rgba(246, 241, 225, 0.55);
  margin-top: 3px;
  font-style: italic;
}
.dupe-stepper {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  flex-shrink: 0;
  border-left: 1px solid var(--line);
  background: rgba(246, 241, 225, 0.02);
}
.dupe-step-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 18px;
  line-height: 1;
  font-weight: 700;
  color: var(--coral);
  background: transparent;
  border: 1px solid rgba(226, 90, 58, 0.35);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s;
}
.dupe-step-btn:hover {
  background: rgba(226, 90, 58, 0.12);
  border-color: var(--coral);
}
.dupe-step-btn:active:not(:disabled) {
  transform: scale(0.94);
}
.dupe-step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  color: rgba(246, 241, 225, 0.4);
  border-color: rgba(246, 241, 225, 0.15);
  background: transparent;
}
.dupe-count {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--coral);
  padding: 4px 10px;
  background: rgba(226, 90, 58, 0.14);
  border-radius: 100px;
  min-width: 42px;
  text-align: center;
}
.dupe-item-empty .dupe-count {
  color: rgba(246, 241, 225, 0.45);
  background: rgba(246, 241, 225, 0.05);
}
.dupe-item-empty .dupe-num {
  color: rgba(246, 241, 225, 0.5);
}

.empty {
  text-align: center;
  padding: 60px 20px;
}
.empty-mark {
  font-size: 48px;
  margin-bottom: 16px;
}
.empty-title {
  font-family: var(--display);
  font-size: 22px;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.empty-sub {
  color: rgba(246, 241, 225, 0.55);
  font-size: 12px;
  line-height: 1.5;
  max-width: 240px;
  margin: 0 auto;
}
.empty-dupes {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.empty-stack {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 20px;
}
.empty-tile {
  position: absolute;
  width: 76px;
  height: 96px;
  border-radius: 8px;
}
.empty-tile-back-l {
  left: 14px;
  top: 14px;
  border: 1.5px dashed rgba(246, 241, 225, 0.18);
  background: rgba(246, 241, 225, 0.02);
  transform: rotate(-8deg);
}
.empty-tile-back-r {
  right: 6px;
  top: 8px;
  border: 1.5px dashed rgba(246, 241, 225, 0.22);
  background: rgba(246, 241, 225, 0.03);
  transform: rotate(6deg);
}
.empty-tile-front {
  left: 50%;
  top: 6px;
  transform: translateX(-50%) rotate(-1deg);
  border: 1.5px dashed rgba(232, 179, 65, 0.45);
  background: rgba(232, 179, 65, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-tile-q {
  font-family: var(--display);
  font-size: 38px;
  color: rgba(232, 179, 65, 0.5);
}
.empty-sparkle-l {
  position: absolute;
  left: -6px;
  bottom: 12px;
  color: var(--gold);
  font-size: 14px;
  opacity: 0.7;
}
.empty-sparkle-r {
  position: absolute;
  right: 0;
  bottom: 4px;
  color: var(--gold);
  font-size: 10px;
  opacity: 0.5;
}
</style>
