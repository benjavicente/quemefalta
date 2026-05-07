<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useStickers } from '@/composables/useStickers';
import { ALBUM_SECTIONS } from '@/lib/albumData';
import SectionView from '@/components/SectionView.vue';
import NoteModal from '@/components/NoteModal.vue';

const { profile, signOut } = useAuth();
const { stickers, stats, loading, loaded, getSticker, setNote } = useStickers();

const activeSection = ref(ALBUM_SECTIONS[0].id);
const view = ref<'album' | 'missing' | 'dupes'>('album');
const noteFor = ref<number | null>(null);

const currentSection = computed(() => {
  return ALBUM_SECTIONS.find((s) => s.id === activeSection.value) ?? ALBUM_SECTIONS[0];
});

const sectionsWithCounts = computed(() => {
  return ALBUM_SECTIONS.map((sec) => {
    let owned = 0;
    for (let i = 0; i < sec.count; i++) {
      if (stickers.value[sec.startsAt + i]?.owned) owned++;
    }
    return { ...sec, owned, complete: owned === sec.count };
  });
});

const missingBySection = computed(() => {
  return ALBUM_SECTIONS.map((sec) => {
    const items: number[] = [];
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      if (!stickers.value[num]?.owned) items.push(num);
    }
    return { section: sec, items };
  }).filter((g) => g.items.length > 0);
});

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

function jumpToSection(sectionId: string) {
  activeSection.value = sectionId;
  view.value = 'album';
}

function copyMissing() {
  const lines: string[] = [`Me faltan ${stats.value.missing} láminas del álbum:`];
  for (const group of missingBySection.value) {
    lines.push(`\n${group.section.name}: ${group.items.join(', ')}`);
  }
  const text = lines.join('\n');
  navigator.clipboard?.writeText(text).then(
    () => alert('¡Lista copiada al portapapeles!'),
    () => alert('No se pudo copiar. Selecciona manualmente.'),
  );
}

async function handleLogout() {
  await signOut();
  window.location.href = '/auth';
}

function handleNoteSave(text: string) {
  if (noteFor.value !== null) {
    setNote(noteFor.value, text);
  }
  noteFor.value = null;
}
</script>

<template>
  <div class="app">
    <!-- HEADER -->
    <header class="hdr">
      <div class="hdr-left">
        <img
          v-if="profile?.avatar_url"
          class="hdr-avatar"
          :src="profile.avatar_url"
          :alt="profile.display_name ?? ''"
        />
        <div>
          <div class="hdr-title">QUEMEFALTA</div>
          <div class="hdr-sub">@{{ profile?.username }}</div>
        </div>
      </div>
      <button class="hdr-logout" @click="handleLogout">SALIR</button>
    </header>

    <!-- LOADING -->
    <div v-if="loading && !loaded" class="loading-state">
      <div class="loading-mark">★</div>
      <div>Cargando tu álbum...</div>
    </div>

    <template v-else>
      <!-- PROGRESS -->
      <section class="progress">
        <div class="progress-row">
          <div>
            <div class="progress-pct">{{ stats.pct }}%</div>
            <div class="progress-label">{{ stats.owned }} de {{ 974 }} láminas</div>
          </div>
          <div class="progress-side">
            <div class="progress-stat">
              <div class="progress-stat-num">{{ stats.missing }}</div>
              <div class="progress-stat-lbl">faltan</div>
            </div>
            <div class="progress-stat">
              <div class="progress-stat-num">{{ stats.dupes }}</div>
              <div class="progress-stat-lbl">repetidas</div>
            </div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${stats.pct}%` }" />
        </div>
      </section>

      <!-- TABS -->
      <nav class="tabs">
        <button :class="['tab', { on: view === 'album' }]" @click="view = 'album'">Álbum</button>
        <button :class="['tab', { on: view === 'missing' }]" @click="view = 'missing'">
          Faltan ({{ stats.missing }})
        </button>
        <button :class="['tab', { on: view === 'dupes' }]" @click="view = 'dupes'">
          Repetidas ({{ stats.dupes }})
        </button>
      </nav>

      <!-- ALBUM VIEW -->
      <template v-if="view === 'album'">
        <div class="sec-picker">
          <button
            v-for="sec in sectionsWithCounts"
            :key="sec.id"
            :class="['sec-chip', { on: activeSection === sec.id, done: sec.complete }]"
            @click="activeSection = sec.id"
          >
            <span class="sec-chip-name">{{ sec.name }}</span>
            <span class="sec-chip-count">{{ sec.owned }}/{{ sec.count }}</span>
          </button>
        </div>
        <SectionView :section="currentSection" @open-note="(n) => (noteFor = n)" />
      </template>

      <!-- MISSING VIEW -->
      <template v-else-if="view === 'missing'">
        <div class="list-view">
          <div class="list-head">
            <div class="list-head-text">
              <h2>Te faltan {{ stats.missing }}</h2>
              <p>
                Toca un número para ir a esa sección, o copia la lista para mandar por WhatsApp.
              </p>
            </div>
            <button v-if="stats.missing > 0" class="copy-btn" @click="copyMissing">
              📋 Copiar
            </button>
          </div>
          <div v-if="stats.missing === 0" class="empty">
            <div class="empty-mark">🏆</div>
            <div class="empty-title">¡Álbum completo!</div>
            <div class="empty-sub">Vamos a celebrar.</div>
          </div>
          <div v-else class="list-grouped">
            <div v-for="group in missingBySection" :key="group.section.id" class="list-group">
              <div class="list-group-head">
                <span>{{ group.section.name }}</span>
                <span class="list-group-count">{{ group.items.length }}</span>
              </div>
              <div class="list-numbers">
                <button
                  v-for="num in group.items"
                  :key="num"
                  class="list-num"
                  @click="jumpToSection(group.section.id)"
                >
                  {{ num }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- DUPES VIEW -->
      <template v-else-if="view === 'dupes'">
        <div class="list-view">
          <div class="list-head">
            <div class="list-head-text">
              <h2>Tienes {{ stats.dupes }} repetidas</h2>
              <p>Listas para canjear. Toca una para abrir la sección.</p>
            </div>
          </div>
          <div v-if="dupesList.length === 0" class="empty">
            <div class="empty-mark">📭</div>
            <div class="empty-title">No tienes repetidas</div>
            <div class="empty-sub">Marca cantidades en el álbum.</div>
          </div>
          <div v-else class="dupes-list">
            <button
              v-for="d in dupesList"
              :key="d.num"
              class="dupe-item"
              @click="jumpToSection(d.sectionId)"
            >
              <div class="dupe-main">
                <div class="dupe-num">#{{ d.num }}</div>
                <div>
                  <div class="dupe-section">{{ d.section }}</div>
                  <div v-if="d.note" class="dupe-note">✎ {{ d.note }}</div>
                </div>
              </div>
              <div class="dupe-count">×{{ d.count }}</div>
            </button>
          </div>
        </div>
      </template>
    </template>

    <!-- NOTE MODAL -->
    <NoteModal
      v-if="noteFor !== null"
      :sticker-number="noteFor"
      :initial-value="getSticker(noteFor).note"
      @save="handleNoteSave"
      @close="noteFor = null"
    />
  </div>
</template>

<style scoped>
.app {
  padding-bottom: 60px;
  max-width: 720px;
  margin: 0 auto;
}

/* HEADER */
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: rgba(6, 35, 24, 0.92);
  backdrop-filter: blur(8px);
  z-index: 10;
}
.hdr-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hdr-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--gold);
}
.hdr-title {
  font-family: var(--display);
  font-size: 18px;
  letter-spacing: 0.1em;
  line-height: 1;
}
.hdr-sub {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  color: var(--chalk-dim);
  margin-top: 2px;
}
.hdr-logout {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  color: var(--chalk-dim);
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: none;
  cursor: pointer;
  transition: all 0.15s;
}
.hdr-logout:hover {
  color: var(--red);
  border-color: var(--red);
}

/* LOADING */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 80px 20px;
  color: var(--chalk-dim);
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.1em;
}
.loading-mark {
  font-size: 36px;
  color: var(--gold);
  animation: spin 2s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(360deg);
  }
}

/* PROGRESS */
.progress {
  padding: 22px 18px 16px;
  border-bottom: 1px solid var(--line);
}
.progress-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 14px;
}
.progress-pct {
  font-family: var(--display);
  font-size: 64px;
  line-height: 0.85;
  color: var(--gold);
  letter-spacing: -0.02em;
}
.progress-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--chalk-dim);
  margin-top: 6px;
}
.progress-side {
  display: flex;
  gap: 18px;
  text-align: right;
}
.progress-stat-num {
  font-family: var(--display);
  font-size: 28px;
  line-height: 1;
}
.progress-stat-lbl {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.15em;
  color: var(--chalk-dim);
  margin-top: 2px;
}
.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 100px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold) 0%, var(--gold-deep) 100%);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba(245, 197, 66, 0.5);
}

/* TABS */
.tabs {
  display: flex;
  padding: 0 18px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.tab {
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--chalk-dim);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  background: none;
  cursor: pointer;
  font-family: inherit;
}
.tab.on {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

/* SECTION PICKER */
.sec-picker {
  display: flex;
  gap: 8px;
  padding: 14px 18px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
}
.sec-picker::-webkit-scrollbar {
  display: none;
}
.sec-chip {
  flex-shrink: 0;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-radius: 100px;
  font-size: 12px;
  font-weight: 600;
  color: var(--chalk-dim);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.sec-chip:hover {
  background: rgba(255, 255, 255, 0.08);
}
.sec-chip.on {
  background: var(--gold);
  color: var(--pitch-deep);
  border-color: var(--gold);
}
.sec-chip.done:not(.on) {
  border-color: rgba(245, 197, 66, 0.4);
  color: var(--gold);
}
.sec-chip-count {
  font-family: var(--mono);
  font-size: 10px;
  opacity: 0.7;
}
.sec-chip.on .sec-chip-count {
  opacity: 1;
}

/* LIST VIEWS */
.list-view {
  padding: 22px 18px;
}
.list-head {
  margin-bottom: 22px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.list-head-text h2 {
  font-family: var(--display);
  font-size: 36px;
  letter-spacing: 0.04em;
  line-height: 1;
  margin: 0 0 6px;
}
.list-head-text p {
  font-size: 13px;
  color: var(--chalk-dim);
  line-height: 1.5;
  margin: 0;
}
.copy-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  background: var(--gold);
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-family: inherit;
}
.copy-btn:hover {
  background: var(--gold-deep);
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
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 12px;
  font-weight: 700;
  font-size: 14px;
}
.list-group-count {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--gold);
  background: rgba(245, 197, 66, 0.1);
  padding: 2px 8px;
  border-radius: 100px;
}
.list-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.list-num {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--chalk);
  cursor: pointer;
}
.list-num:hover {
  background: var(--gold);
  color: var(--pitch-deep);
  border-color: var(--gold);
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
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-left: 3px solid var(--gold);
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
}
.dupe-item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.dupe-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.dupe-num {
  font-family: var(--display);
  font-size: 26px;
  color: var(--gold);
  line-height: 1;
}
.dupe-section {
  font-size: 13px;
  font-weight: 600;
  color: var(--chalk);
}
.dupe-note {
  font-size: 11px;
  color: var(--chalk-dim);
  margin-top: 2px;
  font-style: italic;
}
.dupe-count {
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--gold);
  padding: 4px 10px;
  background: rgba(245, 197, 66, 0.1);
  border-radius: 100px;
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
  font-size: 28px;
  letter-spacing: 0.04em;
}
.empty-sub {
  color: var(--chalk-dim);
  font-size: 13px;
  margin-top: 6px;
}
</style>
