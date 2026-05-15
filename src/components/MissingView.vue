<script setup lang="ts">
import { ref, computed } from 'vue';
import { ALBUM_SECTIONS, TOTAL_STICKERS, codeForSticker } from '@/lib/albumData';
import { pctColor } from '@/lib/progressColors';
import { teamFlagEmoji } from '@/lib/teamFlagEmoji';
import { useStickers } from '@/composables/useStickers';
import SectionSearch from '@/components/SectionSearch.vue';
import { matchesSection } from '@/lib/searchSections';

const emit = defineEmits<{
  jumpToSection: [sectionId: string];
  copied: [message: string];
}>();

const { stickers, stats } = useStickers();

const groupFilter = ref<string | null>(null);
const sortBy = ref<'default' | 'almost'>('default');
const collapsed = ref<Set<string>>(new Set());
const searchQuery = ref('');

function toggleCollapse(sectionId: string) {
  const s = new Set(collapsed.value);
  if (s.has(sectionId)) s.delete(sectionId);
  else s.add(sectionId);
  collapsed.value = s;
}

const missingBySection = computed(() => {
  let sections = ALBUM_SECTIONS.map((sec) => {
    const items: number[] = [];
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      if (!stickers.value[num]?.owned) items.push(num);
    }
    const pctOwned = ((sec.count - items.length) / sec.count) * 100;
    return { section: sec, items, pctOwned };
  }).filter((g) => g.items.length > 0);

  if (groupFilter.value) {
    sections = sections.filter(
      (g) =>
        g.section.group === groupFilter.value ||
        (!g.section.group && groupFilter.value === 'intro'),
    );
  }

  if (searchQuery.value.trim()) {
    sections = sections.filter((g) => matchesSection(g.section, searchQuery.value));
  }

  if (sortBy.value === 'almost') {
    sections = [...sections].sort((a, b) => b.pctOwned - a.pctOwned);
  }

  return sections;
});

function copyMissing() {
  const lines: string[] = [`Me faltan ${stats.value.missing} láminas del álbum:`];
  for (const group of missingBySection.value) {
    lines.push(
      `\n${group.section.name}: ${group.items.map((n: number) => codeForSticker(n)).join(', ')}`,
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
        <h2>TE FALTAN {{ stats.missing }}</h2>
        <p>Toca un número para ir a esa sección, o copia la lista para mandar por WhatsApp.</p>
      </div>
      <button v-if="stats.missing > 0" class="copy-btn" @click="copyMissing">
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

    <!-- Filters -->
    <div v-if="stats.missing > 0 && stats.missing < TOTAL_STICKERS" class="missing-filters">
      <SectionSearch v-model="searchQuery" class="mf-search" />
      <div class="mf-row">
        <select v-model="groupFilter" class="mf-select" aria-label="Filtrar por grupo">
          <option :value="null">Todos los grupos</option>
          <option value="intro">Introducción</option>
          <option v-for="g in 'ABCDEFGHIJKL'.split('')" :key="g" :value="g">Grupo {{ g }}</option>
        </select>
        <select v-model="sortBy" class="mf-select" aria-label="Ordenar por">
          <option value="default">Orden del álbum</option>
          <option value="almost">Casi completas primero</option>
        </select>
      </div>
    </div>

    <div
      v-if="stats.missing > 0 && missingBySection.length === 0"
      class="empty-search"
    >
      Sin resultados para "{{ searchQuery }}".
    </div>

    <div v-if="stats.missing === 0" class="empty">
      <div class="empty-mark">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--gold)"
          stroke-width="1.5"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      </div>
      <div class="empty-title">¡ÁLBUM COMPLETO!</div>
      <div class="empty-sub">Vamos a celebrar.</div>
    </div>
    <div v-else-if="missingBySection.length > 0" class="list-grouped">
      <div v-for="group in missingBySection" :key="group.section.id" class="list-group">
        <div
          class="list-group-head"
          style="cursor: pointer"
          :style="{ borderLeftColor: pctColor(group.pctOwned) }"
          @click="toggleCollapse(group.section.id)"
        >
          <div class="list-group-head-left">
            <span
              v-if="teamFlagEmoji(group.section.code)"
              class="list-group-flag"
              aria-hidden="true"
              >{{ teamFlagEmoji(group.section.code) }}</span
            >
            <span class="list-group-title"
              >{{ group.section.name }} ({{ group.items.length }})</span
            >
            <span v-if="group.pctOwned >= 90" class="almost-badge">¡Casi!</span>
          </div>
          <div class="list-group-head-right">
            <span class="list-group-pct" :style="{ color: pctColor(group.pctOwned) }"
              >{{ Math.round(group.pctOwned) }}%</span
            >
            <span class="list-group-chevron">{{
              collapsed.has(group.section.id) ? '▸' : '▾'
            }}</span>
          </div>
        </div>
        <div v-if="!collapsed.has(group.section.id)" class="list-numbers">
          <button
            v-for="num in group.items"
            :key="num"
            class="list-num"
            @click="emit('jumpToSection', group.section.id)"
          >
            {{ codeForSticker(num) }}
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

.missing-filters {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mf-search {
  width: 100%;
}
.mf-row {
  display: flex;
  gap: 8px;
}
.empty-search {
  text-align: center;
  padding: 30px 20px;
  font-size: 12px;
  color: rgba(246, 241, 225, 0.5);
  font-style: italic;
}
.mf-select {
  flex: 1;
  padding: 9px 12px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--chalk);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23f6f1e1' stroke-opacity='0.4' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.mf-select:focus {
  border-color: var(--gold);
}
.mf-select option {
  background: #141c2b;
  color: var(--chalk);
}

.list-grouped {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.list-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 8px 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--line);
  border-left: 3px solid var(--gold);
  font-weight: 700;
  font-size: 13px;
}
.list-group-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.list-group-flag {
  flex-shrink: 0;
  font-size: 1.15em;
  line-height: 1;
}
.list-group-title {
  min-width: 0;
}
.list-group-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.almost-badge {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 700;
  color: var(--mint);
  background: rgba(95, 194, 138, 0.12);
  padding: 2px 7px;
  border-radius: 100px;
  letter-spacing: 0.05em;
}
.list-group-pct {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.4);
}
.list-group-chevron {
  font-size: 10px;
  color: rgba(246, 241, 225, 0.4);
}
.list-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.list-num {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 6px 9px;
  min-width: 30px;
  text-align: center;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--chalk);
  cursor: pointer;
}
.list-num:hover {
  background: var(--gold);
  color: var(--pitch-deep);
  border-color: var(--gold);
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
</style>
