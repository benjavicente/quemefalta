<script setup lang="ts">
import { ref, computed } from 'vue';
import { ALBUM_SECTIONS } from '@/lib/albumData';
import { useStickers } from '@/composables/useStickers';

const props = defineProps<{
  activeSection: string;
}>();

const emit = defineEmits<{
  select: [sectionId: string];
}>();

const { stickers } = useStickers();

const expanded = ref<string | null>(null);

const GROUPS = 'ABCDEFGHIJKL'.split('');

const groupData = computed(() => {
  return GROUPS.map((g) => {
    const sections = ALBUM_SECTIONS.filter((s) => s.group === g);
    let groupOwned = 0;
    let groupTotal = 0;
    const teams = sections.map((sec) => {
      let owned = 0;
      for (let i = 0; i < sec.count; i++) {
        if (stickers.value[sec.startsAt + i]?.owned) owned++;
      }
      groupOwned += owned;
      groupTotal += sec.count;
      return { ...sec, owned, complete: owned === sec.count };
    });
    return {
      group: g,
      teams,
      owned: groupOwned,
      total: groupTotal,
      pct: groupTotal > 0 ? Math.round((groupOwned / groupTotal) * 100) : 0,
      complete: groupOwned === groupTotal,
    };
  });
});

// Include intro section
const introSection = computed(() => {
  const sec = ALBUM_SECTIONS.find((s) => s.id === 'intro')!;
  let owned = 0;
  for (let i = 0; i < sec.count; i++) {
    if (stickers.value[sec.startsAt + i]?.owned) owned++;
  }
  return { ...sec, owned, complete: owned === sec.count };
});

function toggle(g: string) {
  expanded.value = expanded.value === g ? null : g;
}

function selectTeam(sectionId: string) {
  emit('select', sectionId);
}

const activeGroup = computed(() => {
  const sec = ALBUM_SECTIONS.find((s) => s.id === props.activeSection);
  return sec?.group ?? null;
});
</script>

<template>
  <div class="gp">
    <!-- Intro chip -->
    <button :class="['gp-intro', { on: activeSection === 'intro' }]" @click="selectTeam('intro')">
      <span class="gp-intro-name">Introducción</span>
      <span class="gp-intro-count">{{ introSection.owned }}/{{ introSection.count }}</span>
    </button>

    <!-- Group grid -->
    <div class="gp-grid">
      <div v-for="gd in groupData" :key="gd.group" class="gp-group">
        <button
          :class="[
            'gp-head',
            { on: activeGroup === gd.group, done: gd.complete, expanded: expanded === gd.group },
          ]"
          @click="toggle(gd.group)"
        >
          <div class="gp-head-left">
            <span class="gp-letter">{{ gd.group }}</span>
            <span v-if="gd.complete" class="gp-complete-check">&#10003;</span>
            <span
              class="gp-owned-count"
              :class="{
                'gp-owned-gold': gd.owned > 0 && !gd.complete,
                'gp-owned-mint': gd.complete,
              }"
              >{{ gd.owned }}/{{ gd.total }}</span
            >
          </div>
          <div class="gp-head-bar">
            <div
              class="gp-head-fill"
              :class="{ 'gp-fill-mint': gd.complete }"
              :style="{ width: `${gd.pct}%` }"
            />
          </div>
          <span class="gp-chevron">{{ expanded === gd.group ? '&#9662;' : '&#9656;' }}</span>
        </button>
        <div v-if="expanded === gd.group" class="gp-teams">
          <button
            v-for="team in gd.teams"
            :key="team.id"
            :class="['gp-team', { on: activeSection === team.id, done: team.complete }]"
            @click="selectTeam(team.id)"
          >
            <span class="gp-team-name">{{ team.name }}</span>
            <span class="gp-team-count" :class="{ 'gp-team-done': team.complete }">
              {{ team.owned }}/{{ team.count }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gp {
  padding: 10px clamp(14px, 3vw, 28px) 12px;
  border-bottom: 1px solid var(--line);
}
.gp-intro {
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: rgba(246, 241, 225, 0.7);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-family: inherit;
  margin-bottom: 10px;
  transition: all 0.15s;
}
.gp-intro.on {
  background: rgba(232, 179, 65, 0.1);
  border-color: var(--gold);
  color: var(--gold);
}
.gp-intro-count {
  font-family: var(--mono);
  font-size: 10px;
  opacity: 0.6;
}
.gp-intro.on .gp-intro-count {
  opacity: 1;
}

.gp-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
@media (min-width: 540px) {
  .gp-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.gp-group {
  display: flex;
  flex-direction: column;
}
.gp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: rgba(246, 241, 225, 0.7);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.gp-head:hover {
  background: rgba(246, 241, 225, 0.03);
}
.gp-head.on {
  border-color: rgba(232, 179, 65, 0.4);
}
.gp-head.done {
  border-color: rgba(95, 194, 138, 0.4);
  color: var(--mint);
}
.gp-head.expanded {
  border-radius: 8px 8px 0 0;
  border-bottom-color: transparent;
  background: rgba(246, 241, 225, 0.03);
}
.gp-head-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.gp-letter {
  font-family: var(--display);
  font-size: 20px;
  line-height: 1;
  color: var(--gold);
}
.gp-head.done .gp-letter {
  color: var(--mint);
}
.gp-pct {
  font-family: var(--mono);
  font-size: 9px;
  opacity: 0.6;
}
.gp-complete-check {
  font-size: 11px;
  color: var(--mint);
  font-weight: 700;
  line-height: 1;
}
.gp-owned-count {
  font-family: var(--mono);
  font-size: 9px;
  opacity: 0.5;
  white-space: nowrap;
}
.gp-owned-gold {
  color: var(--gold);
  opacity: 0.8;
}
.gp-owned-mint {
  color: var(--mint);
  opacity: 0.9;
}
.gp-head-bar {
  flex: 1;
  height: 3px;
  background: rgba(246, 241, 225, 0.08);
  border-radius: 100px;
  overflow: hidden;
}
.gp-head-fill {
  height: 100%;
  background: var(--gold);
  border-radius: 100px;
  transition: width 0.3s ease;
}
.gp-fill-mint {
  background: var(--mint);
}
.gp-chevron {
  font-size: 10px;
  opacity: 0.5;
  flex-shrink: 0;
}

.gp-teams {
  border: 1px solid var(--line);
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  animation: slideDown 0.15s ease-out;
}
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 200px;
  }
}
.gp-team {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--line-soft);
  color: rgba(246, 241, 225, 0.7);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.gp-team:last-child {
  border-bottom: none;
}
.gp-team:hover {
  background: rgba(246, 241, 225, 0.04);
}
.gp-team.on {
  background: rgba(232, 179, 65, 0.12);
  color: var(--gold);
}
.gp-team.done {
  color: var(--mint);
}
.gp-team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gp-team-count {
  font-family: var(--mono);
  font-size: 9px;
  opacity: 0.5;
  flex-shrink: 0;
}
.gp-team.on .gp-team-count {
  opacity: 1;
}
.gp-team-done {
  color: var(--mint) !important;
  opacity: 1 !important;
}
</style>
