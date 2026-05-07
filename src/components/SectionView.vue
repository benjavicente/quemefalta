<script setup lang="ts">
import { computed } from 'vue';
import StickerCard from '@/components/StickerCard.vue';
import { useStickers } from '@/composables/useStickers';
import type { AlbumSection } from '@/lib/albumData';

const props = defineProps<{
  section: AlbumSection;
}>();

const emit = defineEmits<{
  openNote: [stickerNumber: number];
}>();

const { stickers, getSticker, cycleSticker, adjustDupes } = useStickers();

const items = computed(() => {
  return Array.from({ length: props.section.count }, (_, i) => {
    const num = props.section.startsAt + i;
    return {
      number: num,
      code: `${props.section.code}${i + 1}`,
      state: getSticker(num),
    };
  });
});

const ownedCount = computed(() => {
  let n = 0;
  for (let i = 0; i < props.section.count; i++) {
    if (stickers.value[props.section.startsAt + i]?.owned) n++;
  }
  return n;
});

const dupesCount = computed(() => {
  let n = 0;
  for (let i = 0; i < props.section.count; i++) {
    const s = stickers.value[props.section.startsAt + i];
    if (s?.owned && s.dupes > 0) n += s.dupes;
  }
  return n;
});
</script>

<template>
  <section class="sect">
    <header class="sect-head">
      <div>
        <div class="sect-name">{{ section.name }}</div>
        <div class="sect-meta">
          #{{ section.startsAt }}–{{ section.startsAt + section.count - 1 }}
        </div>
      </div>
      <div class="sect-stats">
        <span class="pill pill-ok">{{ ownedCount }}/{{ section.count }}</span>
        <span v-if="dupesCount > 0" class="pill pill-dupe">+{{ dupesCount }} rep.</span>
      </div>
    </header>
    <div class="sect-grid">
      <StickerCard
        v-for="item in items"
        :key="item.number"
        :number="item.number"
        :code="item.code"
        :state="item.state"
        @cycle="cycleSticker(item.number)"
        @adjust-dupes="(delta) => adjustDupes(item.number, delta)"
        @open-note="emit('openNote', item.number)"
      />
    </div>
  </section>
</template>

<style scoped>
.sect {
  padding: 18px;
}
.sect-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--line);
}
.sect-name {
  font-family: var(--display);
  font-size: 28px;
  letter-spacing: 0.04em;
  line-height: 1;
}
.sect-meta {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--chalk-dim);
  margin-top: 4px;
}
.sect-stats {
  display: flex;
  gap: 6px;
}
.pill {
  padding: 4px 10px;
  border-radius: 100px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.pill-ok {
  background: rgba(245, 197, 66, 0.15);
  color: var(--gold);
}
.pill-dupe {
  background: rgba(200, 54, 43, 0.15);
  color: #ff8a80;
}
.sect-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 8px;
}
@media (max-width: 380px) {
  .sect-grid {
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  }
}
</style>
