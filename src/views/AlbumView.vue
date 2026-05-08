<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useStickers } from '@/composables/useStickers';
import { ALBUM_SECTIONS, TOTAL_STICKERS, sectionForSticker } from '@/lib/albumData';
import SectionView from '@/components/SectionView.vue';
import StickerDetailModal from '@/components/StickerDetailModal.vue';
import ShareModal from '@/components/ShareModal.vue';

const { profile, signOut } = useAuth();
const {
  stickers,
  stats,
  loading,
  loaded,
  syncError,
  sessionDead,
  getSticker,
  setNote,
  adjustDupes,
  removeSticker,
} = useStickers();

const route = useRoute();
const router = useRouter();

// Leer seccion activa del hash de la URL
const initialSection =
  ALBUM_SECTIONS.find((s) => s.id === route.hash.replace('#', ''))?.id ?? ALBUM_SECTIONS[0].id;

const activeSection = ref(initialSection);
const view = ref<'album' | 'missing' | 'dupes'>('album');

// Sync hash → URL cuando cambia la seccion
watch(activeSection, (id) => {
  router.replace({ hash: `#${id}` });
});
const detailFor = ref<number | null>(null);
const shareOpen = ref(false);
const showCoach = ref(false);
const sectionSearch = ref('');

const detailSectionName = computed(() => {
  if (detailFor.value === null) return '';
  return sectionForSticker(detailFor.value)?.name ?? '';
});

const currentSection = computed(() => {
  return ALBUM_SECTIONS.find((s) => s.id === activeSection.value) ?? ALBUM_SECTIONS[0];
});

const sectionsWithCounts = computed(() => {
  return ALBUM_SECTIONS.map((sec) => {
    let owned = 0;
    for (let i = 0; i < sec.count; i++) {
      if (stickers.value[sec.startsAt + i]?.owned) owned++;
    }
    return { ...sec, owned, complete: owned === sec.count, pct: (owned / sec.count) * 100 };
  });
});

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const filteredSections = computed(() => {
  const q = normalize(sectionSearch.value.trim());
  if (!q) return sectionsWithCounts.value;
  return sectionsWithCounts.value.filter(
    (s) => normalize(s.name).includes(q) || normalize(s.code).includes(q),
  );
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

function selectFirstMatch() {
  if (filteredSections.value.length > 0) {
    activeSection.value = filteredSections.value[0].id;
    sectionSearch.value = '';
  }
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

function handleDetailUpdate(update: { dupes: number; note: string }) {
  if (detailFor.value === null) return;
  const current = getSticker(detailFor.value);
  if (update.dupes !== current.dupes) {
    adjustDupes(detailFor.value, update.dupes - current.dupes);
  }
  if (update.note !== current.note) {
    setNote(detailFor.value, update.note);
  }
  detailFor.value = null;
}

function handleDetailRemove() {
  if (detailFor.value !== null) {
    removeSticker(detailFor.value);
  }
  detailFor.value = null;
}

const userInitial = computed(() => {
  const name = profile.value?.display_name || profile.value?.username || '?';
  return name.charAt(0).toUpperCase();
});
</script>

<template>
  <div class="app">
    <!-- HEADER -->
    <header class="hdr">
      <router-link v-if="profile?.username" class="hdr-left" :to="`/u/${profile.username}`">
        <div v-if="profile?.avatar_url" class="hdr-avatar">
          <img :src="profile.avatar_url" :alt="profile.display_name ?? ''" />
        </div>
        <div v-else class="hdr-avatar hdr-avatar-placeholder">{{ userInitial }}</div>
        <div>
          <div class="hdr-title">QUEMEFALTA</div>
          <div class="hdr-sub">@{{ profile?.username }}</div>
        </div>
      </router-link>
      <div class="hdr-actions">
        <button class="hdr-help-btn" title="Cómo se usa" @click="showCoach = true">?</button>
        <button class="hdr-icon-btn" title="Compartir mi perfil" @click="shareOpen = true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button class="hdr-logout" @click="handleLogout">SALIR</button>
      </div>
    </header>

    <!-- SESSION DEAD POPUP -->
    <div v-if="sessionDead" class="dead-bg">
      <div class="dead-modal">
        <div class="dead-icon">⚠</div>
        <div class="dead-title">SESIÓN EXPIRADA</div>
        <p class="dead-text">
          Tus últimos cambios no se guardaron. Recarga la página para reconectar con el servidor.
        </p>
        <button class="dead-btn" @click="location.reload()">Recargar página</button>
      </div>
    </div>

    <!-- SYNC ERROR (non-fatal) -->
    <div v-if="syncError && !sessionDead" class="sync-error">
      ⚠ Error guardando: {{ syncError }}
    </div>

    <!-- LOADING -->
    <div v-if="loading && !loaded" class="loading-state">
      <div class="loading-mark">★</div>
      <div>Cargando tu álbum...</div>
    </div>

    <template v-else>
      <!-- PROGRESS HERO -->
      <section class="progress">
        <div class="progress-row">
          <div>
            <div class="progress-pct-row">
              <span class="progress-pct">{{ stats.pct }}%</span>
              <span class="progress-of">/100</span>
            </div>
            <div class="progress-label">{{ stats.owned }} de {{ TOTAL_STICKERS }} láminas</div>
          </div>
          <div class="progress-side">
            <div class="progress-stat">
              <div class="progress-stat-num">{{ stats.missing }}</div>
              <div class="progress-stat-lbl">FALTAN</div>
            </div>
            <div class="progress-stat">
              <div class="progress-stat-num" :class="{ 'progress-stat-coral': stats.dupes > 0 }">
                {{ stats.dupes }}
              </div>
              <div class="progress-stat-lbl">REP.</div>
            </div>
          </div>
        </div>
      </section>

      <!-- TABS -->
      <nav class="tabs">
        <button :class="['tab', { on: view === 'album' }]" @click="view = 'album'">Álbum</button>
        <button :class="['tab', { on: view === 'missing' }]" @click="view = 'missing'">
          Faltan {{ stats.missing }}
        </button>
        <button :class="['tab', { on: view === 'dupes' }]" @click="view = 'dupes'">
          Repetidas {{ stats.dupes }}
        </button>
      </nav>

      <!-- ALBUM VIEW -->
      <template v-if="view === 'album'">
        <!-- Search -->
        <div class="sec-search-wrap">
          <input
            v-model="sectionSearch"
            class="sec-search"
            type="text"
            placeholder="Buscar sección... (ej: México, Argentina)"
            autocomplete="off"
            @keydown.enter="selectFirstMatch"
          />
        </div>
        <!-- Section chips with inline progress -->
        <div class="sec-picker">
          <button
            v-for="sec in filteredSections"
            :key="sec.id"
            :class="['sec-chip', { on: activeSection === sec.id, done: sec.complete }]"
            @click="activeSection = sec.id"
          >
            <div class="sec-chip-top">
              <span class="sec-chip-name">{{ sec.name }}</span>
              <span class="sec-chip-count">{{ sec.owned }}/{{ sec.count }}</span>
            </div>
            <div class="sec-chip-bar">
              <div
                class="sec-chip-fill"
                :class="{ 'sec-chip-fill-mint': sec.complete }"
                :style="{ width: `${sec.pct}%` }"
              />
            </div>
          </button>
        </div>
        <SectionView :section="currentSection" @open-detail="(n) => (detailFor = n)" />
      </template>

      <!-- MISSING VIEW -->
      <template v-else-if="view === 'missing'">
        <div class="list-view">
          <div class="list-head">
            <div class="list-head-text">
              <h2>TE FALTAN {{ stats.missing }}</h2>
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
            <div class="empty-title">¡ÁLBUM COMPLETO!</div>
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
              <h2>TIENES {{ stats.dupes }} REPETIDAS</h2>
              <p>Listas para canjear. Toca una para abrir la sección.</p>
            </div>
          </div>
          <div v-if="dupesList.length === 0" class="empty empty-dupes">
            <!-- Custom sticker stack illustration -->
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
              Cuando marques cantidades en el álbum aparecerán aquí, listas para canjear.
            </div>
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
                <div class="dupe-info">
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

    <!-- STICKER DETAIL MODAL -->
    <StickerDetailModal
      v-if="detailFor !== null"
      :sticker-number="detailFor"
      :code="getSticker(detailFor).owned ? '★' : '—'"
      :section-name="detailSectionName"
      :state="getSticker(detailFor)"
      @update="handleDetailUpdate"
      @remove="handleDetailRemove"
      @close="detailFor = null"
    />

    <!-- COACH OVERLAY -->
    <div v-if="showCoach" class="coach-bg">
      <div class="coach">
        <div class="coach-head">
          <div>
            <div class="coach-label">AYUDA</div>
            <div class="coach-title">CÓMO USAR<br />TU ÁLBUM</div>
          </div>
          <button class="coach-close" @click="showCoach = false">✕</button>
        </div>
        <div class="coach-cards">
          <div class="coach-card">
            <div class="coach-demo">
              <div class="demo-circle" />
            </div>
            <div class="coach-card-body">
              <div class="coach-card-title">TOCA PARA PEGAR</div>
              <div class="coach-card-text">
                Un tap en cualquier lámina la marca como pegada. Tócala otra vez y se vuelve
                repetida (×2, ×3…).
              </div>
            </div>
          </div>
          <div class="coach-card">
            <div class="coach-demo">
              <div class="demo-circle demo-solid" />
              <div class="demo-time">2s</div>
            </div>
            <div class="coach-card-body">
              <div class="coach-card-title">MANTÉN PARA EDITAR</div>
              <div class="coach-card-text">
                Mantén presionada una lámina para abrir cantidad exacta, nota o quitarla del álbum.
              </div>
            </div>
          </div>
          <div class="coach-card">
            <div class="coach-demo">
              <div class="demo-grid">
                <div v-for="i in 6" :key="i" :class="['demo-tile', { 'demo-tile-on': i <= 4 }]" />
              </div>
            </div>
            <div class="coach-card-body">
              <div class="coach-card-title">COMPLETA SECCIONES</div>
              <div class="coach-card-text">
                Al final de cada sección hay un botón para marcar las restantes de un golpe.
              </div>
            </div>
          </div>
        </div>
        <button class="coach-cta" @click="showCoach = false">ENTENDIDO</button>
      </div>
    </div>

    <!-- SHARE MODAL -->
    <ShareModal
      v-if="shareOpen && profile"
      :profile="profile"
      :pct="stats.pct"
      @close="shareOpen = false"
    />
  </div>
</template>

<style scoped>
.app {
  padding-bottom: 60px;
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
}
@media (min-width: 700px) {
  .app {
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
}

/* HEADER */
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px clamp(14px, 3vw, 28px) 14px;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: rgba(7, 32, 25, 0.92);
  backdrop-filter: blur(8px);
  z-index: 10;
}
.hdr-left {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
}
.hdr-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid var(--gold);
  overflow: hidden;
}
.hdr-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hdr-avatar-placeholder {
  background: var(--coral);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: 22px;
}
.hdr-title {
  font-family: var(--display);
  font-size: clamp(15px, 2vw, 20px);
  letter-spacing: 0.1em;
  line-height: 1;
}
.hdr-sub {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.05em;
  color: rgba(246, 241, 225, 0.55);
  margin-top: 3px;
}
.hdr-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.hdr-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: rgba(246, 241, 225, 0.6);
  background: none;
  cursor: pointer;
  transition: all 0.15s;
}
.hdr-icon-btn:hover {
  color: var(--gold);
  border-color: var(--gold);
}
.hdr-logout {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: rgba(246, 241, 225, 0.6);
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  transition: all 0.15s;
}
.hdr-logout:hover {
  color: var(--red);
  border-color: var(--red);
}

/* SESSION DEAD POPUP */
.dead-bg {
  position: fixed;
  inset: 0;
  background: rgba(7, 32, 25, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}
.dead-modal {
  background: var(--paper);
  color: var(--ink);
  border-radius: 14px;
  padding: 28px 24px;
  max-width: 360px;
  width: 100%;
  text-align: center;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
}
.dead-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
.dead-title {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 0.06em;
  color: var(--coral);
  margin-bottom: 10px;
}
.dead-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 20px;
}
.dead-btn {
  width: 100%;
  padding: 14px;
  background: var(--coral);
  color: white;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.dead-btn:hover {
  opacity: 0.9;
}

/* SYNC ERROR */
.sync-error {
  padding: 10px 20px;
  background: rgba(200, 54, 43, 0.15);
  border-bottom: 1px solid rgba(200, 54, 43, 0.3);
  color: #ff8a80;
  font-family: var(--mono);
  font-size: 11px;
  text-align: center;
}

/* LOADING */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 80px 20px;
  color: rgba(246, 241, 225, 0.55);
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

/* PROGRESS HERO */
.progress {
  padding: clamp(14px, 3vw, 24px) clamp(14px, 3vw, 28px) clamp(12px, 2vw, 20px);
  border-bottom: 1px solid var(--line);
}
.progress-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}
.progress-pct-row {
  display: flex;
  align-items: baseline;
  gap: clamp(4px, 1.5vw, 10px);
}
.progress-pct {
  font-family: var(--display);
  font-size: clamp(36px, 7vw, 64px);
  line-height: 0.85;
  color: var(--gold);
  letter-spacing: -0.02em;
}
.progress-of {
  font-family: var(--display);
  font-size: clamp(14px, 2.5vw, 22px);
  color: rgba(246, 241, 225, 0.4);
}
.progress-label {
  font-family: var(--mono);
  font-size: clamp(9px, 1.2vw, 11px);
  letter-spacing: 0.1em;
  color: rgba(246, 241, 225, 0.55);
  margin-top: 6px;
}
.progress-side {
  display: flex;
  gap: clamp(10px, 2vw, 20px);
  text-align: right;
}
.progress-stat-num {
  font-family: var(--display);
  font-size: clamp(20px, 3.5vw, 32px);
  line-height: 1;
}
.progress-stat-coral {
  color: var(--coral);
}
.progress-stat-lbl {
  font-family: var(--mono);
  font-size: clamp(7px, 1vw, 9px);
  letter-spacing: 0.18em;
  color: rgba(246, 241, 225, 0.55);
  margin-top: 2px;
}

/* TABS */
.tabs {
  display: flex;
  padding: 0 clamp(14px, 3vw, 28px);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.tab {
  padding: 13px clamp(10px, 2vw, 18px);
  margin-right: 4px;
  font-size: clamp(10px, 1.4vw, 12px);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(246, 241, 225, 0.5);
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

/* SECTION SEARCH */
.sec-search-wrap {
  padding: 10px clamp(14px, 3vw, 28px) 0;
}
.sec-search {
  width: 100%;
  padding: 10px 14px;
  font-family: inherit;
  font-size: 13px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk);
  outline: none;
}
.sec-search::placeholder {
  color: rgba(246, 241, 225, 0.35);
}
.sec-search:focus {
  border-color: var(--gold);
  background: rgba(246, 241, 225, 0.06);
}

/* SECTION PICKER */
.sec-picker {
  display: flex;
  gap: 6px;
  padding: 10px clamp(14px, 3vw, 28px) 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
}
.sec-picker::-webkit-scrollbar {
  display: none;
}
.sec-chip {
  flex-shrink: 0;
  padding: 8px 14px 6px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(246, 241, 225, 0.7);
  display: flex;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  min-width: 100px;
  text-align: left;
}
.sec-chip:hover {
  background: rgba(246, 241, 225, 0.05);
}
.sec-chip.on {
  background: rgba(232, 179, 65, 0.1);
  color: var(--gold);
  border-color: var(--gold);
}
.sec-chip.done:not(.on) {
  border-color: rgba(95, 194, 138, 0.4);
  color: var(--mint);
}
.sec-chip-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}
.sec-chip-name {
  white-space: nowrap;
}
.sec-chip-count {
  font-family: var(--mono);
  font-size: 9px;
  opacity: 0.6;
  flex-shrink: 0;
}
.sec-chip.on .sec-chip-count {
  opacity: 1;
}

/* Chip inline progress bar */
.sec-chip-bar {
  width: 100%;
  height: 3px;
  background: rgba(246, 241, 225, 0.1);
  border-radius: 100px;
  overflow: hidden;
}
.sec-chip-fill {
  height: 100%;
  background: var(--gold);
  border-radius: 100px;
  transition: width 0.3s ease;
}
.sec-chip.on .sec-chip-fill {
  background: var(--gold);
}
.sec-chip-fill-mint {
  background: var(--mint);
}
.sec-chip.on .sec-chip-fill-mint {
  background: var(--mint);
}

/* LIST VIEWS */
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

.list-grouped {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.list-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
  font-size: 13px;
}
.list-group-count {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--gold);
  background: rgba(232, 179, 65, 0.1);
  padding: 2px 8px;
  border-radius: 100px;
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

/* DUPES LIST */
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
  font-family: var(--display);
  font-size: 26px;
  color: var(--gold);
  line-height: 1;
  flex-shrink: 0;
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

/* EMPTY STATES */
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

/* Dupes empty - sticker stack illustration */
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

/* HELP BUTTON */
.hdr-help-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(232, 179, 65, 0.45);
  border-radius: 6px;
  color: var(--gold);
  background: rgba(232, 179, 65, 0.06);
  font-family: var(--display);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s;
}
.hdr-help-btn:hover {
  background: rgba(232, 179, 65, 0.15);
}

/* COACH OVERLAY */
.coach-bg {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(10, 12, 15, 0.92);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  padding: 60px 24px 24px;
  color: var(--chalk);
  animation: fadeIn 0.15s ease-out;
}
.coach {
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.coach-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.coach-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--gold);
  margin-bottom: 6px;
}
.coach-title {
  font-family: var(--display);
  font-size: 30px;
  line-height: 0.95;
  letter-spacing: 0.02em;
}
.coach-close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(246, 241, 225, 0.08);
  border: 1px solid var(--line);
  color: var(--chalk);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.coach-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
}
.coach-card {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 10px;
  background: rgba(246, 241, 225, 0.04);
  border: 1px solid var(--line);
}
.coach-demo {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  position: relative;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
}
.demo-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--gold);
  opacity: 0.3;
}
.demo-solid {
  opacity: 1;
}
.demo-time {
  position: absolute;
  top: 6px;
  right: 6px;
  font-family: var(--mono);
  font-size: 8px;
  color: var(--gold);
  letter-spacing: 0.1em;
}
.demo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 8px;
  width: 100%;
}
.demo-tile {
  aspect-ratio: 1;
  border-radius: 2px;
  background: rgba(232, 179, 65, 0.2);
  border: 1px dashed var(--gold);
}
.demo-tile-on {
  background: var(--gold);
  border: none;
}
.coach-card-body {
  flex: 1;
}
.coach-card-title {
  font-family: var(--display);
  font-size: 16px;
  letter-spacing: 0.06em;
  color: var(--gold);
  margin-bottom: 4px;
}
.coach-card-text {
  font-size: 11.5px;
  line-height: 1.5;
  color: rgba(246, 241, 225, 0.78);
}
.coach-cta {
  margin-top: 16px;
  padding: 14px 0;
  width: 100%;
  background: var(--gold);
  color: var(--pitch-deep);
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.06em;
  cursor: pointer;
  font-family: inherit;
}
</style>
