<script setup lang="ts">
import { computed } from 'vue';
import StickerCard from '@/components/StickerCard.vue';
import { useStickers } from '@/composables/useStickers';
import type { AlbumSection } from '@/lib/albumData';

const props = defineProps<{
  section: AlbumSection;
}>();

const emit = defineEmits<{
  openDetail: [stickerNumber: number];
}>();

const { stickers, getSticker, cycleSticker, markSectionComplete, clearSection } = useStickers();

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

const isComplete = computed(() => ownedCount.value === props.section.count);

const hasAny = computed(() => ownedCount.value > 0);

function completeSection() {
  markSectionComplete(props.section.startsAt, props.section.count);
}

function resetSection() {
  clearSection(props.section.startsAt, props.section.count);
}
</script>

<template>
  <section class="sect">
    <header class="sect-head">
      <div>
        <div class="sect-name">{{ section.name }}</div>
        <div class="sect-meta">
          #{{ section.startsAt }}—{{ section.startsAt + section.count - 1 }}
        </div>
      </div>
      <div class="sect-badge">{{ ownedCount }}/{{ section.count }}</div>
    </header>
    <div class="sect-grid">
      <StickerCard
        v-for="item in items"
        :key="item.number"
        :number="item.number"
        :code="item.code"
        :state="item.state"
        @cycle="cycleSticker(item.number)"
        @open-detail="emit('openDetail', item.number)"
      />
    </div>
    <div class="sect-actions">
      <div class="sect-btns">
        <button v-if="!isComplete" class="complete-btn" @click="completeSection">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Completar {{ section.name }}
        </button>
        <div v-else class="complete-done">✓ Sección completa</div>
        <button
          v-if="hasAny"
          class="clear-btn"
          :title="`Quitar las ${ownedCount} pegadas de ${section.name}`"
          @click="resetSection"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" />
          </svg>
        </button>
      </div>
      <div class="sect-hint">
        Completar marca {{ section.count - ownedCount }} restantes · 🗑 quita las
        {{ ownedCount }} pegadas
      </div>
    </div>
  </section>
</template>

<style scoped>
.sect {
  padding: 0 clamp(14px, 3vw, 28px) 30px;
}
.sect-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 16px 0 8px;
}
.sect-name {
  font-family: var(--display);
  font-size: clamp(22px, 4vw, 34px);
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
}
.sect-meta {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(246, 241, 225, 0.5);
  margin-top: 4px;
}
.sect-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 4px;
  background: rgba(232, 179, 65, 0.12);
  color: var(--gold);
  letter-spacing: 0.05em;
}
.sect-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding-top: 8px;
}
@media (min-width: 480px) {
  .sect-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
@media (min-width: 580px) {
  .sect-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
.sect-actions {
  margin-top: 16px;
}
.sect-btns {
  display: flex;
  gap: 8px;
}
.complete-btn {
  flex: 1;
  padding: 14px 0;
  background: transparent;
  border: 1.5px solid var(--gold);
  border-radius: 8px;
  color: var(--gold);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s;
}
.complete-btn:hover {
  background: rgba(232, 179, 65, 0.08);
}
.complete-done {
  flex: 1;
  padding: 14px;
  text-align: center;
  border: 1px solid rgba(95, 194, 138, 0.3);
  border-radius: 8px;
  color: var(--mint);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.clear-btn {
  padding: 14px 16px;
  background: transparent;
  border: 1.5px solid rgba(226, 90, 58, 0.45);
  border-radius: 8px;
  color: var(--coral);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
}
.clear-btn:hover {
  background: rgba(226, 90, 58, 0.08);
}
.sect-hint {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(246, 241, 225, 0.4);
  text-align: center;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
