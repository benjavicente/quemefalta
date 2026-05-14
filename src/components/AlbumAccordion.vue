<script setup lang="ts">
import { ref, computed } from 'vue';
import SectionView from '@/components/SectionView.vue';
import { ALBUM_SECTIONS } from '@/lib/albumData';
import { barColor, pctColor } from '@/lib/progressColors';
import { teamFlagEmoji } from '@/lib/teamFlagEmoji';
import { useStickers } from '@/composables/useStickers';

const emit = defineEmits<{
  openDetail: [stickerNumber: number];
  sectionChange: [sectionId: string];
}>();

const { stickers } = useStickers();

const expandedGroup = ref<string | null>(null);
const expandedTeam = ref<string | null>(null);

const GROUPS = 'ABCDEFGHIJKL'.split('');

const introSection = computed(() => {
  const sec = ALBUM_SECTIONS.find((s) => s.id === 'intro')!;
  let owned = 0;
  for (let i = 0; i < sec.count; i++) {
    if (stickers.value[sec.startsAt + i]?.owned) owned++;
  }
  return { ...sec, owned, complete: owned === sec.count };
});

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
      return {
        ...sec,
        owned,
        complete: owned === sec.count,
        pct: Math.round((owned / sec.count) * 100),
      };
    });
    return {
      group: g,
      teams,
      owned: groupOwned,
      total: groupTotal,
      pct: groupTotal > 0 ? Math.round((groupOwned / groupTotal) * 100) : 0,
      complete: groupOwned === groupTotal,
      completedTeams: teams.filter((t) => t.complete).length,
      totalTeams: teams.length,
    };
  });
});

function toggleGroup(g: string) {
  if (expandedGroup.value === g) {
    expandedGroup.value = null;
    expandedTeam.value = null;
  } else {
    expandedGroup.value = g;
    expandedTeam.value = null;
  }
}

function toggleTeam(sectionId: string) {
  const opening = expandedTeam.value !== sectionId;
  expandedTeam.value = opening ? sectionId : null;
  if (opening) emit('sectionChange', sectionId);
}

function getTeamSection(sectionId: string) {
  return ALBUM_SECTIONS.find((s) => s.id === sectionId)!;
}

// Expose for parent to programmatically open a section (e.g. from search/jump)
function openSection(sectionId: string) {
  if (sectionId === 'intro') {
    expandedGroup.value = null;
    expandedTeam.value = 'intro';
    return;
  }
  const sec = ALBUM_SECTIONS.find((s) => s.id === sectionId);
  if (sec?.group) {
    expandedGroup.value = sec.group;
    expandedTeam.value = sectionId;
  }
}

defineExpose({ openSection });
</script>

<template>
  <div class="acc">
    <!-- Intro section -->
    <div class="acc-item">
      <button
        :class="['acc-team', { on: expandedTeam === 'intro', done: introSection.complete }]"
        @click="toggleTeam('intro')"
      >
        <span class="acc-team-flag">⚽</span>
        <span class="acc-team-name">Introducción & FIFA</span>
        <div class="acc-team-bar">
          <div
            class="acc-team-fill"
            :style="{
              width: `${Math.round((introSection.owned / introSection.count) * 100)}%`,
              background: barColor(
                Math.round((introSection.owned / introSection.count) * 100),
                introSection.complete,
              ),
            }"
          />
        </div>
        <div class="acc-team-right">
          <span class="acc-team-count" :class="{ 'acc-count-done': introSection.complete }">
            {{ introSection.owned }}/{{ introSection.count }}
          </span>
          <span
            class="acc-completed-pill"
            :style="introSection.complete ? { '--pill-color': pctColor(100) } : undefined"
            :aria-label="introSection.complete ? 'Sección completa' : 'Sección sin completar'"
          >
            <svg
              v-if="introSection.complete"
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ introSection.complete ? 1 : 0 }}/1
          </span>
          <span class="acc-chevron">{{ expandedTeam === 'intro' ? '▾' : '▸' }}</span>
        </div>
      </button>
      <div v-if="expandedTeam === 'intro'" class="acc-content">
        <SectionView :section="introSection" @open-detail="(n) => emit('openDetail', n)" />
      </div>
    </div>

    <!-- Groups A-L -->
    <div v-for="gd in groupData" :key="gd.group" class="acc-group">
      <button
        :class="['acc-group-head', { expanded: expandedGroup === gd.group, done: gd.complete }]"
        @click="toggleGroup(gd.group)"
      >
        <div class="acc-group-left">
          <span class="acc-group-letter">{{ gd.group }}</span>
          <div class="acc-group-bar">
            <div
              class="acc-group-fill"
              :style="{ width: `${gd.pct}%`, background: barColor(gd.pct, gd.complete) }"
            />
          </div>
          <span class="acc-group-pct">{{ gd.pct }}%</span>
        </div>
        <div class="acc-group-right">
          <span class="acc-group-count">{{ gd.owned }}/{{ gd.total }}</span>
          <span
            class="acc-completed-pill"
            :style="
              gd.completedTeams > 0
                ? { '--pill-color': pctColor((gd.completedTeams / gd.totalTeams) * 100) }
                : undefined
            "
            :aria-label="`${gd.completedTeams} de ${gd.totalTeams} equipos completos`"
          >
            <svg
              v-if="gd.completedTeams === gd.totalTeams"
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ gd.completedTeams }}/{{ gd.totalTeams }}
          </span>
          <span class="acc-chevron">{{ expandedGroup === gd.group ? '▾' : '▸' }}</span>
        </div>
      </button>

      <!-- Teams inside group -->
      <div v-if="expandedGroup === gd.group" class="acc-teams">
        <div v-for="team in gd.teams" :key="team.id" class="acc-item">
          <button
            :class="['acc-team', { on: expandedTeam === team.id, done: team.complete }]"
            @click="toggleTeam(team.id)"
          >
            <span class="acc-team-flag">{{ teamFlagEmoji(team.code) }}</span>
            <span class="acc-team-name">{{ team.name }}</span>
            <div class="acc-team-bar">
              <div
                class="acc-team-fill"
                :style="{ width: `${team.pct}%`, background: barColor(team.pct, team.complete) }"
              />
            </div>
            <div class="acc-team-right">
              <span class="acc-team-count" :class="{ 'acc-count-done': team.complete }">
                {{ team.owned }}/{{ team.count }}
              </span>
              <span class="acc-chevron">{{ expandedTeam === team.id ? '▾' : '▸' }}</span>
            </div>
          </button>
          <div v-if="expandedTeam === team.id" class="acc-content">
            <SectionView
              :section="getTeamSection(team.id)"
              @open-detail="(n) => emit('openDetail', n)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.acc {
  padding: 8px clamp(14px, 3vw, 28px) 20px;
}

/* Group header */
.acc-group-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--chalk);
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 6px;
}
.acc-group-head:first-child {
  margin-top: 0;
}
.acc-group-head:hover {
  background: rgba(246, 241, 225, 0.03);
}
.acc-group-head.expanded {
  border-radius: 10px 10px 0 0;
  border-bottom-color: transparent;
  background: rgba(246, 241, 225, 0.03);
}
.acc-group-head.done {
  border-color: rgba(77, 208, 161, 0.3);
}
.acc-group-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.acc-group-letter {
  font-family: var(--display);
  font-size: 24px;
  line-height: 1;
  color: var(--gold);
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}
.acc-group-head.done .acc-group-letter {
  color: var(--mint);
}
.acc-group-bar {
  flex: 1;
  height: 4px;
  background: rgba(246, 241, 225, 0.08);
  border-radius: 100px;
  overflow: hidden;
}
.acc-group-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.3s ease;
}
.acc-group-pct {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--chalk-dim);
  flex-shrink: 0;
  width: 30px;
  text-align: right;
}
.acc-group-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}
.acc-group-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--chalk-dim);
}

/* Secciones-completas pill (grupos A-L y FWC intro).
 * Toma color de la escala de progreso pero aplicada al RATIO de la pill
 * (completedTeams/totalTeams), no al pct de stickers. Sin --pill-color (0/N) → neutro. */
.acc-completed-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid var(--pill-color, var(--line));
  border-radius: 6px;
  background: color-mix(in srgb, var(--pill-color, transparent) 12%, transparent);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1;
  color: var(--pill-color, var(--chalk-dim));
  white-space: nowrap;
}

/* Teams container */
.acc-teams {
  border: 1px solid var(--line);
  border-top: none;
  border-radius: 0 0 10px 10px;
  overflow: hidden;
}

/* Team row */
.acc-item {
  border-bottom: 1px solid var(--line-soft);
}
.acc-item:last-child {
  border-bottom: none;
}
/* Standalone intro item */
.acc > .acc-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.acc-team {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 14px;
  background: transparent;
  border: none;
  color: var(--chalk);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
}
.acc-team:hover {
  background: rgba(246, 241, 225, 0.04);
}
.acc-team.on {
  background: rgba(240, 180, 41, 0.08);
  color: var(--gold);
}
.acc-team.done {
  color: var(--mint);
}
.acc-team-flag {
  font-size: 16px;
  flex-shrink: 0;
}
.acc-team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.acc-team-bar {
  flex: 1;
  height: 3px;
  background: rgba(246, 241, 225, 0.08);
  border-radius: 100px;
  overflow: hidden;
  min-width: 30px;
}
.acc-team-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.3s ease;
}
.acc-team-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.acc-team-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--chalk-dim);
}
.acc-team.on .acc-team-count {
  color: var(--gold);
}
.acc-count-done {
  color: var(--mint) !important;
}
.acc-chevron {
  font-size: 10px;
  color: var(--chalk-dim);
  flex-shrink: 0;
  width: 10px;
  text-align: center;
}

/* Sticker grid content area */
.acc-content {
  border-top: 1px solid var(--line-soft);
  background: rgba(246, 241, 225, 0.015);
}
</style>
