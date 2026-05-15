<script setup lang="ts">
import { computed } from 'vue';
import { ALBUM_SECTIONS, codeForSticker } from '@/lib/albumData';
import { useStickers } from '@/composables/useStickers';

const emit = defineEmits<{
  openDetail: [stickerNumber: number];
  copied: [message: string];
}>();

const { stickers, stats } = useStickers();

const dupesList = computed(() => {
  const out: { num: number; section: string; sectionId: string; count: number; note: string }[] =
    [];
  for (const sec of ALBUM_SECTIONS) {
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      const s = stickers.value[num];
      if (s?.owned && s.dupes > 0) {
        out.push({
          num,
          section: sec.name,
          sectionId: sec.id,
          count: s.dupes,
          note: s.note,
        });
      }
    }
  }
  return out.sort((a, b) => a.num - b.num);
});

function copyDupes() {
  const lines: string[] = [`Tengo ${stats.value.dupes} láminas repetidas para cambiar:`];
  const bySection = new Map<string, { code: string; count: number }[]>();
  for (const d of dupesList.value) {
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
    <div v-if="dupesList.length === 0" class="empty empty-dupes">
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
      <button
        v-for="d in dupesList"
        :key="d.num"
        class="dupe-item"
        @click="emit('openDetail', d.num)"
      >
        <div class="dupe-main">
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
        </div>
        <div class="dupe-count">+{{ d.count }}</div>
      </button>
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

.dupes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dupe-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: rgba(246, 241, 225, 0.025);
  border: 1px solid var(--line);
  border-left: 3px solid var(--coral);
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  color: inherit;
}
.dupe-item:hover {
  background: rgba(246, 241, 225, 0.05);
}
.dupe-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
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
.dupe-count {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--coral);
  padding: 4px 10px;
  background: rgba(226, 90, 58, 0.14);
  border-radius: 100px;
  flex-shrink: 0;
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
