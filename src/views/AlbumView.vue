<script setup lang="ts">
import { ref, computed, watch, onMounted, provide } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useStickers } from '@/composables/useStickers';
import { useMeta } from '@/composables/useMeta';
import { ALBUM_SECTIONS, TOTAL_STICKERS, sectionForSticker, codeForSticker } from '@/lib/albumData';
import { pctColor } from '@/lib/progressColors';
import StickerDetailModal from '@/components/StickerDetailModal.vue';
import ShareModal from '@/components/ShareModal.vue';
import AlbumAccordion from '@/components/AlbumAccordion.vue';
import MissingView from '@/components/MissingView.vue';
import DupesView from '@/components/DupesView.vue';
import CalculadoraView from '@/components/CalculadoraView.vue';
import BatchInput from '@/components/BatchInput.vue';
import StickerScanner from '@/components/StickerScanner.vue';
import CsvModal from '@/components/CsvModal.vue';
import UndoToast from '@/components/UndoToast.vue';
import OnboardingGuide from '@/components/OnboardingGuide.vue';

const { user, profile, signOut } = useAuth();
const isPreview = computed(() => !user.value);
provide('isPreview', isPreview);
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
  addBatch,
  cycleSticker,
} = useStickers();

const route = useRoute();
const router = useRouter();

// Leer estado inicial del hash de la URL
const rawHash = route.hash.replace('#', '');
const initialView: 'album' | 'missing' | 'dupes' | 'calc' =
  rawHash === 'missing' ? 'missing' : rawHash === 'dupes' ? 'dupes' : rawHash === 'calc' ? 'calc' : 'album';
const initialSection = ALBUM_SECTIONS.find((s) => s.id === rawHash)?.id ?? ALBUM_SECTIONS[0].id;

const activeSection = ref(initialSection);
const view = ref(initialView);

function setView(v: 'album' | 'missing' | 'dupes' | 'calc') {
  view.value = v;
  if (v === 'album') {
    // Keep current section hash or clear
    router.replace({ hash: '' });
  } else {
    router.replace({ hash: `#${v}` });
  }
}
const reloadPage = () => location.reload();
const accordionRef = ref<InstanceType<typeof AlbumAccordion> | null>(null);
const progressRef = ref<HTMLElement | null>(null);
const detailFor = ref<number | null>(null);
const shareOpen = ref(false);
const showBatchInput = ref(false);
const showScanner = ref(false);
const showCsvModal = ref(false);
const showProfileMenu = ref(false);
const showLoginPrompt = ref(false);
const sectionSearch = ref('');

// Undo toast state
const undoToast = ref({ visible: false, message: '', action: null as (() => void) | null });

// Onboarding guide
const showOnboarding = ref(false);

// Long-press onboarding
const showLongPressTip = ref(false);
const hasSeenLongPressTip = ref(false);

onMounted(() => {
  hasSeenLongPressTip.value = localStorage.getItem('qmf-longpress-tip') === '1';

  // Restore state from URL hash
  if (rawHash) {
    setTimeout(() => {
      if (initialView === 'album' && initialSection !== ALBUM_SECTIONS[0].id) {
        accordionRef.value?.openSection(initialSection);
        // Scroll to the opened team row
        setTimeout(() => {
          const openTeam = document.querySelector('.acc-team.on');
          if (openTeam) {
            openTeam.scrollIntoView({ behavior: 'instant', block: 'start' });
          }
        }, 50);
      } else if (initialView !== 'album') {
        // Missing/dupes — scroll to just above the tabs
        progressRef.value?.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }, 150);
  }
});

// Show onboarding when loaded, authenticated, and truly new user (0 stickers)
watch(
  [loaded, () => stats.value.owned],
  ([isLoaded, ownedCount]) => {
    if (isLoaded && ownedCount === 0 && !localStorage.getItem('quemefalta_onboarding_done')) {
      showOnboarding.value = true;
    }
  },
  { immediate: true },
);

function onFirstSticker() {
  if (!hasSeenLongPressTip.value) {
    showLongPressTip.value = true;
    hasSeenLongPressTip.value = true;
    localStorage.setItem('qmf-longpress-tip', '1');
    setTimeout(() => {
      showLongPressTip.value = false;
    }, 4000);
  }
}

const detailSectionName = computed(() => {
  if (detailFor.value === null) return '';
  return sectionForSticker(detailFor.value)?.name ?? '';
});

const albumMeta = computed(() => ({
  title: `Mi álbum (${stats.value.pct}%) — QueMeFalta`,
}));

useMeta(albumMeta);

// Detail modal: prev/next navigation
const detailSectionStickers = computed(() => {
  if (detailFor.value === null) return [];
  const sec = sectionForSticker(detailFor.value);
  if (!sec) return [];
  return Array.from({ length: sec.count }, (_, i) => sec.startsAt + i);
});

const detailIndex = computed(() => {
  if (detailFor.value === null) return -1;
  return detailSectionStickers.value.indexOf(detailFor.value);
});

function detailPrev() {
  if (detailIndex.value > 0) {
    detailFor.value = detailSectionStickers.value[detailIndex.value - 1];
  }
}

function detailNext() {
  if (detailIndex.value < detailSectionStickers.value.length - 1) {
    detailFor.value = detailSectionStickers.value[detailIndex.value + 1];
  }
}

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
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const filteredSections = computed(() => {
  const q = normalize(sectionSearch.value.trim());
  if (!q) return sectionsWithCounts.value;
  return sectionsWithCounts.value.filter(
    (s) => normalize(s.name).includes(q) || normalize(s.code).includes(q),
  );
});

// Tab previews
const almostCompleteSections = computed(() => {
  return sectionsWithCounts.value
    .filter((s) => s.pct >= 50 && !s.complete)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
});

// Progress bar color
const progressBarColor = computed(() => pctColor(stats.value.pct));

function jumpToSection(sectionId: string) {
  view.value = 'album';
  router.replace({ hash: `#${sectionId}` });
  // Wait for the accordion to render, then open the section
  setTimeout(() => accordionRef.value?.openSection(sectionId), 50);
}

function selectFirstMatch() {
  if (filteredSections.value.length > 0) {
    activeSection.value = filteredSections.value[0].id;
    sectionSearch.value = '';
  }
}

function handleCopied(message: string) {
  undoToast.value = { visible: true, message, action: null };
  setTimeout(() => {
    undoToast.value.visible = false;
  }, 2000);
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

function handleDetailMark() {
  if (detailFor.value !== null) {
    cycleSticker(detailFor.value);
  }
}

// Batch input handler
async function handleBatchAdd(numbers: number[]) {
  showBatchInput.value = false;
  if (isPreview.value) {
    showLoginPrompt.value = true;
    return;
  }
  const count = await addBatch(numbers);
  if (count && count > 0) {
    undoToast.value = {
      visible: true,
      message: `${count} láminas agregadas al álbum`,
      action: null,
    };
    setTimeout(() => {
      undoToast.value.visible = false;
    }, 3000);
  }
}

// Scanner handler — reuses the same toast logic
async function handleScannerAdd(numbers: number[]) {
  showScanner.value = false;
  if (isPreview.value) {
    showLoginPrompt.value = true;
    return;
  }
  const count = await addBatch(numbers);
  if (count && count > 0) {
    undoToast.value = {
      visible: true,
      message: `${count} láminas escaneadas y agregadas`,
      action: null,
    };
    setTimeout(() => {
      undoToast.value.visible = false;
    }, 3000);
  }
}

function handleSectionOpenDetail(n: number) {
  if (isPreview.value) {
    showLoginPrompt.value = true;
    return;
  }
  detailFor.value = n;
  onFirstSticker();
}

const userInitial = computed(() => {
  const name = profile.value?.display_name || profile.value?.username || '?';
  return name.charAt(0).toUpperCase();
});
</script>

<template>
  <div class="app" @click="showProfileMenu = false">
    <!-- HEADER (simplified) -->
    <header class="hdr">
      <div class="hdr-left">
        <div class="hdr-brand">
          <div class="hdr-title">QUEMEFALTA</div>
        </div>
      </div>
      <div class="hdr-actions">
        <template v-if="isPreview">
          <button class="hdr-signup-btn" @click="router.push('/auth')">Crear cuenta</button>
        </template>
        <template v-else>
          <button
            class="hdr-icon-btn"
            title="Compartir mi perfil"
            aria-label="Compartir mi perfil"
            @click="shareOpen = true"
          >
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
          <button
            class="hdr-icon-btn"
            title="Tutorial de uso"
            aria-label="Tutorial de uso"
            @click="showOnboarding = true"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
          <!-- Profile button with dropdown -->
          <div class="profile-wrap" @click.stop>
            <button
              class="hdr-profile-btn"
              aria-label="Menú de perfil"
              @click="showProfileMenu = !showProfileMenu"
            >
              <div v-if="profile?.avatar_url" class="hdr-avatar">
                <img :src="profile.avatar_url" :alt="profile.display_name ?? ''" />
              </div>
              <div v-else class="hdr-avatar hdr-avatar-placeholder">{{ userInitial }}</div>
            </button>
            <div v-if="showProfileMenu" class="profile-menu">
              <router-link v-if="profile?.username" class="pm-item" :to="`/u/${profile.username}`">
                <span>Mi perfil</span>
                <span class="pm-user">@{{ profile.username }}</span>
              </router-link>
              <button
                class="pm-item"
                @click="
                  showCsvModal = true;
                  showProfileMenu = false;
                "
              >
                Exportar / Importar CSV
              </button>
              <button class="pm-item pm-danger" @click="handleLogout">Cerrar sesión</button>
            </div>
          </div>
        </template>
      </div>
    </header>

    <!-- SESSION DEAD POPUP -->
    <div v-if="sessionDead && !isPreview" class="dead-bg">
      <div class="dead-modal" role="alert">
        <div class="dead-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--coral)"
            stroke-width="2"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div class="dead-title">SESIÓN EXPIRADA</div>
        <p class="dead-text">
          Tus últimos cambios no se guardaron. Recarga la página para reconectar con el servidor.
        </p>
        <button class="dead-btn" @click="reloadPage">Recargar página</button>
      </div>
    </div>

    <!-- SYNC ERROR (non-fatal) -->
    <div v-if="syncError && !sessionDead && !isPreview" class="sync-error" role="alert">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        style="flex-shrink: 0"
      >
        <path
          d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      Error guardando: {{ syncError }}
    </div>

    <!-- PREVIEW BANNER -->
    <div v-if="isPreview" class="preview-banner">
      <span>Modo preview — </span>
      <router-link to="/auth" class="preview-link">Crea tu cuenta</router-link>
      <span> para guardar tu progreso</span>
    </div>

    <!-- LOADING -->
    <div v-if="!isPreview && loading && !loaded" class="loading-state">
      <div class="loading-mark">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          />
        </svg>
      </div>
      <div>Cargando tu álbum...</div>
    </div>

    <template v-else>
      <!-- PROGRESS HERO with bar -->
      <section ref="progressRef" class="progress">
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
        <!-- Visual progress bar -->
        <div
          class="progress-bar"
          role="progressbar"
          :aria-valuenow="stats.pct"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`Progreso del álbum: ${stats.pct}%`"
        >
          <div
            class="progress-bar-fill"
            :style="{ width: `${stats.pct}%`, background: progressBarColor }"
          />
        </div>
      </section>

      <!-- TABS with preview hints -->
      <nav class="tabs">
        <button :class="['tab', { on: view === 'album' }]" @click="setView('album')">Álbum</button>
        <button :class="['tab', { on: view === 'missing' }]" @click="setView('missing')">
          Faltan {{ stats.missing }}
        </button>
        <button :class="['tab', { on: view === 'dupes' }]" @click="setView('dupes')">
          Repetidas {{ stats.dupes }}
        </button>
        <button :class="['tab', { on: view === 'calc' }]" @click="setView('calc')">
          Calculadora
        </button>
        <button class="tab-scan" title="Escanear sobre" @click="showScanner = true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
        </button>
        <!-- Batch input button -->
        <button class="tab-add" title="Agregar láminas por número" @click="showBatchInput = true">
          + Agregar
        </button>
      </nav>

      <!-- Tab preview hints -->
      <div v-if="view === 'album' && almostCompleteSections.length > 0" class="tab-preview">
        <span class="tab-preview-label">Casi completas:</span>
        <button
          v-for="sec in almostCompleteSections"
          :key="sec.id"
          class="tab-preview-chip"
          @click="jumpToSection(sec.id)"
        >
          {{ sec.name }} <span class="tab-preview-pct">{{ Math.round(sec.pct) }}%</span>
        </button>
      </div>

      <!-- ALBUM VIEW -->
      <template v-if="view === 'album'">
        <!-- Search -->
        <div class="sec-search-wrap">
          <input
            v-model="sectionSearch"
            class="sec-search"
            type="text"
            aria-label="Buscar sección"
            placeholder="Buscar sección... (ej: México, Argentina)"
            autocomplete="off"
            @keydown.enter="selectFirstMatch"
          />
        </div>
        <!-- Search results -->
        <div v-if="sectionSearch" class="sec-picker">
          <button
            v-for="sec in filteredSections"
            :key="sec.id"
            :class="['sec-chip', { done: sec.complete }]"
            @click="
              sectionSearch = '';
              accordionRef?.openSection(sec.id);
            "
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
        <!-- Accordion (groups → teams → sticker grids inline) -->
        <AlbumAccordion
          v-show="!sectionSearch"
          ref="accordionRef"
          @open-detail="handleSectionOpenDetail"
          @section-change="(id) => router.replace({ hash: `#${id}` })"
        />
      </template>

      <!-- MISSING VIEW -->
      <MissingView
        v-else-if="view === 'missing'"
        @jump-to-section="jumpToSection"
        @copied="handleCopied"
      />

      <!-- DUPES VIEW -->
      <DupesView
        v-else-if="view === 'dupes'"
        @open-detail="handleSectionOpenDetail"
        @copied="handleCopied"
      />

      <!-- CALCULADORA VIEW -->
      <CalculadoraView v-else-if="view === 'calc'" />
    </template>

    <!-- STICKER DETAIL MODAL (with prev/next) -->
    <StickerDetailModal
      v-if="detailFor !== null"
      :sticker-number="detailFor"
      :code="codeForSticker(detailFor)"
      :section-name="detailSectionName"
      :state="getSticker(detailFor)"
      :has-prev="detailIndex > 0"
      :has-next="detailIndex < detailSectionStickers.length - 1"
      @update="handleDetailUpdate"
      @remove="handleDetailRemove"
      @mark="handleDetailMark"
      @close="detailFor = null"
      @prev="detailPrev"
      @next="detailNext"
    />

    <!-- BATCH INPUT MODAL -->
    <BatchInput v-if="showBatchInput" @add="handleBatchAdd" @close="showBatchInput = false" />

    <!-- STICKER SCANNER MODAL -->
    <StickerScanner v-if="showScanner" @add="handleScannerAdd" @close="showScanner = false" />
    <CsvModal v-if="showCsvModal" @close="showCsvModal = false" @imported="showCsvModal = false" />

    <!-- LONG-PRESS TIP -->
    <Transition name="tip">
      <div v-if="showLongPressTip" class="longpress-tip">
        💡 Mantén presionada una lámina para editar cantidad, notas o quitarla.
      </div>
    </Transition>

    <!-- UNDO TOAST -->
    <UndoToast
      :message="undoToast.message"
      :visible="undoToast.visible"
      @undo="
        undoToast.action?.();
        undoToast.visible = false;
      "
      @dismiss="undoToast.visible = false"
    />

    <!-- SHARE MODAL -->
    <ShareModal
      v-if="shareOpen && profile"
      :profile="profile"
      :pct="stats.pct"
      @close="shareOpen = false"
    />

    <!-- ONBOARDING GUIDE -->
    <OnboardingGuide v-if="showOnboarding" @done="showOnboarding = false" />

    <!-- LOGIN PROMPT (preview mode) -->
    <Teleport to="body">
      <div v-if="showLoginPrompt" class="login-prompt-bg" @click.self="showLoginPrompt = false">
        <div class="login-prompt">
          <div class="login-prompt-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
          </div>
          <div class="login-prompt-title">Crea tu cuenta</div>
          <p class="login-prompt-text">Para marcar láminas, escanear sobres y llevar tu progreso necesitas una cuenta.</p>
          <button class="login-prompt-btn" @click="router.push('/auth')">Crear cuenta con Google</button>
          <button class="login-prompt-dismiss" @click="showLoginPrompt = false">Seguir mirando</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app {
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  max-width: 640px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: 100dvh;
}
@media (min-width: 700px) {
  .app {
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
}

/* HEADER (simplified) */
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  padding-right: calc(clamp(14px, 3vw, 28px) + env(safe-area-inset-right, 0px));
  padding-bottom: 14px;
  padding-left: calc(clamp(14px, 3vw, 28px) + env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  background: rgba(12, 18, 32, 0.92);
  backdrop-filter: blur(8px);
  z-index: 10;
}
.hdr-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hdr-brand {
  text-decoration: none;
  color: inherit;
}
.hdr-title {
  font-family: var(--display);
  font-size: clamp(18px, 2.5vw, 24px);
  letter-spacing: 0.1em;
  line-height: 1;
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

/* Profile dropdown */
.profile-wrap {
  position: relative;
}
.hdr-profile-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.hdr-avatar {
  width: 34px;
  height: 34px;
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
  font-size: 18px;
}
.profile-menu {
  position: absolute;
  top: 42px;
  right: 0;
  background: #141c2b;
  border: 1px solid var(--line);
  border-radius: 10px;
  min-width: 180px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 20;
  animation: fadeIn 0.1s ease-out;
}
.pm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--chalk);
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--line-soft);
}
.pm-item:last-child {
  border-bottom: none;
}
.pm-item:hover {
  background: rgba(246, 241, 225, 0.04);
}
.pm-user {
  font-family: var(--mono);
  font-size: 10px;
  color: rgba(246, 241, 225, 0.5);
}
.pm-danger {
  color: var(--coral);
}
.pm-danger:hover {
  background: rgba(226, 90, 58, 0.08);
}

/* SESSION DEAD POPUP */
.dead-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.85);
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
  display: flex;
  align-items: center;
  gap: 8px;
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
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
/* Progress bar */
.progress-bar {
  height: 6px;
  background: rgba(246, 241, 225, 0.08);
  border-radius: 100px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  border-radius: 100px;
  transition:
    width 0.5s ease,
    background 0.5s ease;
}

/* TABS */
.tabs {
  display: flex;
  padding: 0 clamp(8px, 2vw, 28px);
  border-bottom: 1px solid var(--line);
  align-items: center;
  flex-wrap: nowrap;
}
.tab {
  padding: 13px clamp(6px, 1.5vw, 18px);
  font-size: clamp(9px, 1.3vw, 12px);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(246, 241, 225, 0.5);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  background: none;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 1;
  min-width: 0;
}
.tab.on {
  color: var(--gold);
  border-bottom-color: var(--gold);
}
.tab-scan {
  margin-left: auto;
  width: clamp(28px, 4vw, 32px);
  height: clamp(28px, 4vw, 32px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gold);
  background: rgba(232, 179, 65, 0.08);
  border: 1px solid rgba(232, 179, 65, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.tab-scan:hover {
  background: rgba(232, 179, 65, 0.15);
}
.tab-add {
  margin-left: 0;
  padding: 7px clamp(8px, 1.5vw, 14px);
  font-size: clamp(9px, 1.3vw, 11px);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--gold);
  background: rgba(232, 179, 65, 0.08);
  border: 1px solid rgba(232, 179, 65, 0.3);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s;
}
.tab-add:hover {
  background: rgba(232, 179, 65, 0.15);
}

/* Tab preview hints */
.tab-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px clamp(14px, 3vw, 28px);
  overflow-x: auto;
  border-bottom: 1px solid var(--line-soft);
}
.tab-preview::-webkit-scrollbar {
  display: none;
}
.tab-preview-label {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: rgba(246, 241, 225, 0.4);
  flex-shrink: 0;
}
.tab-preview-chip {
  padding: 4px 10px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 600;
  background: rgba(95, 194, 138, 0.08);
  border: 1px solid rgba(95, 194, 138, 0.25);
  color: var(--mint);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  flex-shrink: 0;
}
.tab-preview-chip:hover {
  background: rgba(95, 194, 138, 0.15);
}
.tab-preview-pct {
  font-family: var(--mono);
  font-size: 9px;
  opacity: 0.7;
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

/* SECTION PICKER (fallback for search) */
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
.sec-chip-fill-mint {
  background: var(--mint);
}

/* Missing view filters */
/* LONG-PRESS TIP */
.longpress-tip {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--gold);
  color: var(--pitch-deep);
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  max-width: 340px;
  width: calc(100% - 40px);
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 50;
}
.tip-enter-active {
  transition: all 0.2s ease-out;
}
.tip-leave-active {
  transition: all 0.3s ease-in;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
.collapsed-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px clamp(14px, 3vw, 28px);
  margin: 8px clamp(14px, 3vw, 28px) 0;
  background: rgba(246, 241, 225, 0.03);
  border: 1px solid rgba(95, 194, 138, 0.25);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 48px;
}
.collapsed-section:hover {
  background: rgba(246, 241, 225, 0.06);
}
.collapsed-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.collapsed-name {
  font-family: var(--display);
  font-size: 16px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.collapsed-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.collapsed-badge {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--mint);
  background: rgba(95, 194, 138, 0.12);
  padding: 3px 10px;
  border-radius: 100px;
}
.collapsed-count {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--mint);
  opacity: 0.7;
}
.collapsed-chevron {
  font-size: 12px;
  color: rgba(246, 241, 225, 0.4);
}
.collapse-back-btn {
  display: block;
  margin: 12px auto 0;
  padding: 8px 18px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: rgba(246, 241, 225, 0.5);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.collapse-back-btn:hover {
  color: var(--chalk);
  border-color: var(--chalk);
}

/* PREVIEW BANNER */
.preview-banner {
  padding: 10px clamp(14px, 3vw, 28px);
  background: rgba(232, 179, 65, 0.1);
  border-bottom: 1px solid rgba(232, 179, 65, 0.25);
  font-size: 12px;
  font-weight: 600;
  color: var(--gold);
  text-align: center;
}
.preview-link {
  color: var(--gold);
  text-decoration: underline;
  font-weight: 700;
}

/* HEADER SIGNUP BUTTON */
.hdr-signup-btn {
  padding: 8px 16px;
  background: var(--gold);
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.08em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}
.hdr-signup-btn:hover {
  opacity: 0.9;
}

/* LOGIN PROMPT MODAL */
.login-prompt-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.8);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}
.login-prompt {
  background: var(--paper);
  color: var(--ink);
  border-radius: 14px;
  padding: 28px 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
}
.login-prompt-icon {
  margin-bottom: 12px;
}
.login-prompt-title {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 0.06em;
  color: var(--pitch);
  margin-bottom: 8px;
}
.login-prompt-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 20px;
}
.login-prompt-btn {
  width: 100%;
  padding: 14px;
  background: var(--gold);
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.login-prompt-btn:hover {
  opacity: 0.9;
}
.login-prompt-dismiss {
  display: block;
  margin: 12px auto 0;
  padding: 8px;
  background: none;
  border: none;
  color: var(--ink-soft);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}
.login-prompt-dismiss:hover {
  color: var(--ink);
}
</style>
