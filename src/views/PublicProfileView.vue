<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase, withAuthRetry, reestablishConnection } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useShare } from '@/composables/useShare';
import { TOTAL_STICKERS, TOTAL_SECTIONS, ALBUM_SECTIONS, codeForSticker } from '@/lib/albumData';
import { useMeta } from '@/composables/useMeta';
import { track } from '@/lib/analytics';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  owned_count: number;
  dupes_count: number;
}

const route = useRoute();
const router = useRouter();
const { user, profile: myProfile } = useAuth();

const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const notFound = ref(false);
const loadError = ref<string | null>(null);
const retryAttempt = ref(0); // 0 = primer intento, >=1 = reintentando

// Distingue 'no encontrado' (la query devolvio data:null sin error → el perfil
// realmente no existe) de 'error cargando' (timeout, red, server) — un timeout
// no debe mostrarse como "perfil no encontrado" porque confunde al usuario.
function isTransientError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  const code = (err.code ?? '').toLowerCase();
  return (
    code === 'timeout' ||
    msg.includes('tardando') ||
    msg.includes('timeout') ||
    msg.includes('sin conexión') ||
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('lenta')
  );
}
const stickerMap = ref<Map<number, { owned: boolean; dupes: number }>>(new Map());
const copied = ref('');

const username = computed(() => route.params.username as string);

const isOwnProfile = computed(() => {
  return user.value && profile.value && user.value.id === profile.value.id;
});

// Lista de páginas completadas (la usamos tanto para el contador como para el
// tooltip; un solo barrido sobre stickerMap).
// Formato: equipos prefijados con su grupo "(A) México"; FWC sin prefijo.
const completedSectionNames = computed(() => {
  if (stickerMap.value.size === 0) return [] as string[];
  const labels: string[] = [];
  for (const sec of ALBUM_SECTIONS) {
    let done = true;
    for (let i = 0; i < sec.count; i++) {
      if (!stickerMap.value.get(sec.startsAt + i)?.owned) {
        done = false;
        break;
      }
    }
    if (done) labels.push(sec.group ? `(${sec.group}) ${sec.name}` : sec.name);
  }
  return labels;
});

const showPagesPopover = ref(false);
function closePagesPopover() {
  showPagesPopover.value = false;
}

const stats = computed(() => {
  if (!profile.value) {
    return { pct: 0, owned: 0, missing: 0, dupes: 0, completedSections: 0 };
  }
  const owned = profile.value.owned_count;
  return {
    pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
    owned,
    missing: TOTAL_STICKERS - owned,
    dupes: profile.value.dupes_count,
    completedSections: completedSectionNames.value.length,
  };
});

const firstName = computed(() => {
  return profile.value?.display_name?.split(' ')[0] ?? profile.value?.username;
});

const metaInfo = computed(() => {
  if (!profile.value) {
    return {
      title: 'Cargando perfil... — QueMeFalta',
    };
  }
  const name = profile.value.display_name || profile.value.username;
  return {
    title: `${name} — ${stats.value.pct}% del álbum — QueMeFalta`,
    description: `${name} tiene ${stats.value.owned} de ${TOTAL_STICKERS} láminas del álbum del Mundial 2026 (${stats.value.pct}% completo). Mira su progreso y conecta para cambiar.`,
    ogTitle: `${name} — ${stats.value.pct}% del álbum del Mundial`,
    ogDescription: `${stats.value.owned} láminas de ${TOTAL_STICKERS} (${stats.value.pct}% completo). ${stats.value.dupes > 0 ? `${stats.value.dupes} repetidas para cambiar.` : ''}`,
  };
});

useMeta(metaInfo);

const userInitial = computed(() => {
  const name = profile.value?.display_name || profile.value?.username || '?';
  return name.charAt(0).toUpperCase();
});

const missingBySection = computed(() => {
  if (stickerMap.value.size === 0 && stats.value.owned === 0) return [];
  return ALBUM_SECTIONS.map((sec) => {
    const items: number[] = [];
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      if (!stickerMap.value.get(num)?.owned) items.push(num);
    }
    return { section: sec, items };
  }).filter((g) => g.items.length > 0);
});

const dupesBySection = computed(() => {
  const groups = new Map<string, { section: string; items: { code: string; count: number }[] }>();
  for (const sec of ALBUM_SECTIONS) {
    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      const s = stickerMap.value.get(num);
      if (s?.owned && s.dupes > 0) {
        if (!groups.has(sec.id)) groups.set(sec.id, { section: sec.name, items: [] });
        groups.get(sec.id)!.items.push({ code: codeForSticker(num), count: s.dupes + 1 });
      }
    }
  }
  return [...groups.values()];
});

const { share, isNativeShareAvailable } = useShare();
const sharing = ref(false);

async function shareProfile() {
  if (sharing.value || !profile.value) return;
  sharing.value = true;
  try {
    const name = profile.value.display_name || profile.value.username;
    const url = `${globalThis.location.origin}/u/${profile.value.username}`;
    const ownerLabel = isOwnProfile.value ? 'Mi álbum' : `El álbum de ${name}`;
    const result = await share({
      title: `${ownerLabel} del Mundial — ${stats.value.pct}% completo`,
      text: `${ownerLabel} del Mundial: ${stats.value.owned} de ${TOTAL_STICKERS} láminas (${stats.value.pct}% completo).`,
      url,
    });
    track('share_profile', {
      kind: isOwnProfile.value ? 'own' : 'other',
      result,
    });
    if (result === 'copied') {
      copied.value = 'Link copiado';
      setTimeout(() => {
        copied.value = '';
      }, 2000);
    }
  } finally {
    sharing.value = false;
  }
}

function copyMissing() {
  const lines = [`A ${firstName.value} le faltan ${stats.value.missing} láminas:`];
  for (const g of missingBySection.value) {
    lines.push(`${g.section.name}: ${g.items.map((n) => codeForSticker(n)).join(', ')}`);
  }
  navigator.clipboard?.writeText(lines.join('\n')).then(() => {
    copied.value = 'Faltantes copiadas';
    setTimeout(() => {
      copied.value = '';
    }, 2000);
  });
}

function copyDupes() {
  const lines = [`${firstName.value} tiene ${stats.value.dupes} repetidas para cambiar:`];
  for (const g of dupesBySection.value) {
    lines.push(`${g.section}: ${g.items.map((i) => `${i.code} (×${i.count})`).join(', ')}`);
  }
  navigator.clipboard?.writeText(lines.join('\n')).then(() => {
    copied.value = 'Repetidas copiadas';
    setTimeout(() => {
      copied.value = '';
    }, 2000);
  });
}

// Backoff para auto-retry. Despues de agotarlos, mostramos error con boton manual.
// Mas corto: cada attempt ya tiene su propio timeout interno (5s refresh + 8s
// query), no necesitamos esperar mucho entre retries. El usuario quiere
// feedback rapido — despues de ~15s mostramos el error con boton manual.
const PROFILE_RETRY_DELAYS = [800, 2000];

async function loadProfileData(attempt = 0): Promise<void> {
  loading.value = true;
  notFound.value = false;
  loadError.value = null;
  retryAttempt.value = attempt;

  // Las queries van por withAuthRetry para tener timeout (8s) + retry. Las tablas
  // son publicas (public_album_stats, public_user_stickers) asi que no requieren
  // auth — NO llamamos getSession/ensureFreshSession aca para no arriesgar un
  // hang del cliente Supabase si lleva mucho tiempo idle.
  const { data, error } = await withAuthRetry(() =>
    supabase.from('public_album_stats').select('*').eq('username', username.value).maybeSingle(),
  );

  if (error) {
    console.error('[PublicProfileView] profile load error:', error);
    if (isTransientError(error)) {
      // Error transitorio (timeout/red): rehacer conexion + auto-retry con backoff,
      // sin recargar la página. reestablishConnection() es lo que hace efectivamente
      // un reload: fuerza refresh de sesion, obtiene access_token nuevo, limpia
      // cache stale del cliente. La UI muestra "Reintentando..." mientras.
      if (attempt < PROFILE_RETRY_DELAYS.length) {
        const delay = PROFILE_RETRY_DELAYS[attempt];
        console.log(`[PublicProfileView] retry ${attempt + 1} in ${delay}ms`);
        setTimeout(() => {
          void (async () => {
            await reestablishConnection();
            void loadProfileData(attempt + 1);
          })();
        }, delay);
        return; // dejamos loading=true para que siga el spinner
      }
      // Agotamos retries → mostrar error con boton manual.
      loadError.value = 'No pudimos cargar el perfil. Conexión lenta o sin internet.';
      loading.value = false;
      return;
    }
    notFound.value = true;
    loading.value = false;
    return;
  }

  if (!data) {
    notFound.value = true;
    loading.value = false;
    return;
  }

  profile.value = data as PublicProfile;

  // Fetch individual sticker data for missing/dupes lists
  const { data: stickers, error: stickersErr } = await withAuthRetry(() =>
    supabase
      .from('public_user_stickers')
      .select('sticker_number, owned, dupes')
      .eq('username', username.value),
  );

  if (stickersErr) {
    console.error('[PublicProfileView] stickers load error:', stickersErr);
    // Profile cargado pero stickers fallaron — mostrar el profile sin lista detallada.
  } else if (Array.isArray(stickers)) {
    const map = new Map<number, { owned: boolean; dupes: number }>();
    for (const s of stickers as {
      sticker_number: number;
      owned: boolean;
      dupes: number | null;
    }[]) {
      map.set(s.sticker_number, { owned: s.owned, dupes: s.dupes ?? 0 });
    }
    stickerMap.value = map;
  }

  loading.value = false;
}

function retryLoad() {
  void loadProfileData(0);
}

onMounted(() => loadProfileData(0));

const compareInput = ref('');
const showCompareInput = ref(false);

function goToMyAlbum() {
  if (user.value) {
    router.push('/album');
  } else {
    router.push('/auth');
  }
}

function compareWithMe() {
  if (myProfile.value?.username && profile.value) {
    router.push(`/intercambio/${profile.value.username}/${myProfile.value.username}`);
  }
}

function compareWithOther() {
  const other = compareInput.value.trim().replace(/^@/, '');
  if (other && profile.value && other !== profile.value.username) {
    router.push(`/intercambio/${profile.value.username}/${other}`);
  }
}
</script>

<template>
  <div class="public-wrap" @click="closePagesPopover">
    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
      <div class="loading-mark">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          />
        </svg>
      </div>
      <div v-if="retryAttempt === 0">Cargando perfil...</div>
      <div v-else>Conexión lenta. Reintentando...</div>
    </div>

    <!-- NOT FOUND -->
    <div v-else-if="notFound" class="not-found">
      <div class="nf-mark">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--chalk-dim)"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1>Perfil no encontrado</h1>
      <p>
        No existe un perfil con el username <strong>@{{ username }}</strong
        >.
      </p>
      <p class="nf-sub">El usuario quizás cambió su username o su perfil es privado.</p>
      <button class="btn-back" @click="goToMyAlbum">
        {{ user ? 'Volver a mi álbum' : 'Crear mi cuenta' }}
      </button>
    </div>

    <!-- LOAD ERROR (timeout / red) -->
    <div v-else-if="loadError" class="not-found">
      <div class="nf-mark">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--coral)"
          stroke-width="1.5"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h1>No se pudo cargar el perfil</h1>
      <p>{{ loadError }}</p>
      <button class="btn-back" @click="retryLoad">Reintentar</button>
    </div>

    <!-- PROFILE CARD -->
    <div v-else-if="profile" class="card">
      <div class="card-star">
        <svg
          width="180"
          height="180"
          viewBox="0 0 24 24"
          fill="var(--gold)"
          stroke="none"
          opacity="0.15"
        >
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          />
        </svg>
      </div>

      <!-- Avatar -->
      <div class="hero">
        <div v-if="profile.avatar_url" class="avatar">
          <img :src="profile.avatar_url" :alt="profile.display_name ?? profile.username" />
        </div>
        <div v-else class="avatar avatar-placeholder">{{ userInitial }}</div>
      </div>

      <div class="name">{{ (profile.display_name || profile.username).toUpperCase() }}</div>
      <div class="handle">@{{ profile.username }}</div>

      <!-- Big stat -->
      <div class="big-stat">
        <span class="big-num">{{ stats.pct }}</span>
        <span class="big-pct">%</span>
      </div>
      <div class="big-label">DEL ÁLBUM COMPLETO</div>

      <!-- Progress bar -->
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: `${stats.pct}%` }" />
      </div>

      <!-- Stats grid -->
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-num">{{ stats.owned }}</div>
          <div class="stat-lbl">TIENE</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ stats.missing }}</div>
          <div class="stat-lbl">FALTAN</div>
        </div>
        <div class="stat">
          <div class="stat-num stat-num-coral">{{ stats.dupes }}</div>
          <div class="stat-lbl">REP.</div>
        </div>
        <div class="stat stat-pages">
          <button
            type="button"
            class="stat-btn"
            :aria-expanded="showPagesPopover"
            aria-label="Ver páginas completadas"
            @click.stop="showPagesPopover = !showPagesPopover"
            @keydown.escape="showPagesPopover = false"
          >
            <div
              class="stat-num"
              :class="{ 'stat-num-mint': stats.completedSections === TOTAL_SECTIONS }"
            >
              {{ stats.completedSections }}/{{ TOTAL_SECTIONS }}
            </div>
            <div class="stat-lbl">PÁGINAS</div>
          </button>
          <div
            v-if="showPagesPopover"
            class="pages-popover"
            role="dialog"
            aria-label="Páginas completadas"
            @click.stop
          >
            <div class="pages-popover-head">
              Páginas completas
              <span class="pages-popover-count">
                {{ stats.completedSections }}/{{ TOTAL_SECTIONS }}
              </span>
            </div>
            <p v-if="completedSectionNames.length === 0" class="pages-popover-empty">
              Todavía no completó ninguna página.
            </p>
            <ul v-else class="pages-popover-list">
              <li v-for="name in completedSectionNames" :key="name" class="pages-popover-item">
                <svg
                  width="10"
                  height="10"
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
                {{ name }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- MISSING / DUPES expandable lists -->
      <div v-if="stickerMap.size > 0" class="lists">
        <!-- Missing -->
        <details v-if="stats.missing > 0" class="list-detail">
          <summary class="list-summary">
            <span>Faltan {{ stats.missing }}</span>
            <button class="list-copy" @click.prevent="copyMissing">Copiar</button>
          </summary>
          <div class="list-body">
            <div v-for="g in missingBySection" :key="g.section.id" class="list-group">
              <div class="list-group-name">{{ g.section.name }}</div>
              <div class="list-group-codes">
                {{ g.items.map((n) => codeForSticker(n)).join(', ') }}
              </div>
            </div>
          </div>
        </details>

        <!-- Dupes -->
        <details v-if="stats.dupes > 0" class="list-detail">
          <summary class="list-summary">
            <span>{{ stats.dupes }} repetidas</span>
            <button class="list-copy" @click.prevent="copyDupes">Copiar</button>
          </summary>
          <div class="list-body">
            <div v-for="g in dupesBySection" :key="g.section" class="list-group">
              <div class="list-group-name">{{ g.section }}</div>
              <div class="list-group-codes">
                {{ g.items.map((i) => `${i.code} (×${i.count})`).join(', ') }}
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- CTA -->
      <div class="cta">
        <button
          class="share-btn"
          :disabled="sharing"
          :aria-label="isOwnProfile ? 'Compartir mi perfil' : `Compartir el perfil de ${firstName}`"
          @click="shareProfile"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          {{ isNativeShareAvailable ? 'Compartir perfil' : 'Copiar link' }}
        </button>

        <button v-if="isOwnProfile" class="cta-btn" @click="router.push('/album')">
          Volver a mi álbum
        </button>
        <!-- Compare (own profile) -->
        <div v-if="isOwnProfile" class="compare-row">
          <button v-if="!showCompareInput" class="compare-link" @click="showCompareInput = true">
            Comparar con otro perfil
          </button>
          <form v-else class="compare-form" @submit.prevent="compareWithOther">
            <input
              v-model="compareInput"
              class="compare-input"
              placeholder="@username"
              autocomplete="off"
              autocapitalize="off"
            />
            <button type="submit" class="compare-go" :disabled="!compareInput.trim()">
              Comparar
            </button>
          </form>
        </div>
        <template v-else>
          <button class="cta-btn" @click="goToMyAlbum">
            {{ user ? 'Ver mi álbum' : 'Crear mi álbum' }}
          </button>

          <!-- Compare with logged-in user -->
          <button
            v-if="myProfile?.username && myProfile.username !== profile.username"
            class="compare-btn"
            @click="compareWithMe"
          >
            Comparar con mi álbum
          </button>

          <!-- Compare with another user -->
          <div class="compare-row">
            <button v-if="!showCompareInput" class="compare-link" @click="showCompareInput = true">
              Comparar con otro perfil
            </button>
            <form v-else class="compare-form" @submit.prevent="compareWithOther">
              <input
                v-model="compareInput"
                class="compare-input"
                placeholder="@username"
                autocomplete="off"
                autocapitalize="off"
              />
              <button type="submit" class="compare-go" :disabled="!compareInput.trim()">
                Comparar
              </button>
            </form>
          </div>
        </template>
      </div>

      <!-- Copy / share toast — fuera de .lists para que aparezca también en perfiles sin stickers cargados -->
      <div v-if="copied" class="list-toast">{{ copied }}</div>

      <div class="footer">
        <a href="/" class="brand">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="var(--gold)"
            stroke="none"
            style="vertical-align: middle; margin-right: 4px"
          >
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            />
          </svg>
          QueMeFalta
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.public-wrap {
  min-height: 100vh;
  padding: 24px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: radial-gradient(
    ellipse at 50% 0%,
    rgba(232, 179, 65, 0.08) 0%,
    transparent 60%
  );
}

.loading-state,
.not-found {
  text-align: center;
  padding: 80px 20px;
  color: rgba(246, 241, 225, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
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
.nf-mark {
  font-size: 64px;
  margin-bottom: 8px;
}
.not-found h1 {
  font-family: var(--display);
  font-size: 36px;
  color: var(--gold);
  margin: 0;
}
.not-found p {
  font-size: 14px;
  color: var(--chalk);
  max-width: 320px;
  margin: 0;
}
.not-found .nf-sub {
  color: rgba(246, 241, 225, 0.55);
  font-size: 12px;
}
.btn-back {
  margin-top: 16px;
  padding: 12px 24px;
  background: var(--gold);
  color: var(--pitch-deep);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.1em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}

/* CARD */
.card {
  width: 100%;
  max-width: 480px;
  background: var(--paper);
  color: var(--ink);
  border-radius: 14px;
  padding: 28px 22px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
}
.card-star {
  position: absolute;
  top: -20px;
  right: -20px;
  font-family: var(--display);
  font-size: 180px;
  line-height: 0.9;
  color: var(--gold);
  opacity: 0.15;
  pointer-events: none;
}

.hero {
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
}
.avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 3px solid var(--gold);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-placeholder {
  background: var(--coral);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: 44px;
}

.name {
  font-family: var(--display);
  font-size: 28px;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--pitch);
  text-align: center;
}
.handle {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-soft);
  margin-top: 6px;
  text-align: center;
  letter-spacing: 0.05em;
}

.big-stat {
  text-align: center;
  margin-top: 20px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}
.big-num {
  font-family: var(--display);
  font-size: 84px;
  line-height: 0.85;
  color: var(--pitch);
  letter-spacing: -0.02em;
}
.big-pct {
  font-family: var(--display);
  font-size: 40px;
  line-height: 0.85;
  color: var(--gold);
}
.big-label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-soft);
  margin-top: 6px;
  text-align: center;
  text-transform: uppercase;
}

.bar-track {
  height: 8px;
  background: var(--paper-deep);
  border-radius: 100px;
  overflow: hidden;
  margin: 18px 0 22px;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gold) 0%, var(--gold-deep) 100%);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  text-align: center;
  padding: 16px 0;
  border-top: 1px dashed var(--paper-deep);
  border-bottom: 1px dashed var(--paper-deep);
}
.stat-num {
  font-family: var(--display);
  font-size: 26px;
  color: var(--pitch);
  line-height: 1;
}
.stat-num-coral {
  color: var(--coral);
}
.stat-num-mint {
  color: var(--mint);
}
.stat-lbl {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--ink-soft);
  letter-spacing: 0.15em;
  margin-top: 4px;
}
/* Stat clickeable de Páginas + popover con la lista. */
.stat-pages {
  position: relative;
}
.stat-btn {
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  text-align: center;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.stat-btn:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: 4px;
}
.pages-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  max-width: min(280px, 90vw);
  max-height: 60vh;
  overflow-y: auto;
  background: var(--paper);
  border: 1px solid var(--paper-deep);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 100;
  text-align: left;
}
.pages-popover-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px dashed var(--paper-deep);
}
.pages-popover-count {
  font-family: var(--mono);
  color: var(--mint);
}
.pages-popover-empty {
  font-size: 12px;
  color: var(--ink-soft);
  line-height: 1.4;
  margin: 0;
}
.pages-popover-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pages-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--pitch);
  line-height: 1.2;
}
.pages-popover-item svg {
  color: var(--mint);
  flex-shrink: 0;
}

/* Expandable lists */
.lists {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-detail {
  border: 1px solid var(--paper-deep);
  border-radius: 8px;
  overflow: hidden;
}
.list-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  cursor: pointer;
  list-style: none;
}
.list-summary::-webkit-details-marker {
  display: none;
}
.list-summary::before {
  content: '▶';
  font-size: 8px;
  margin-right: 8px;
  transition: transform 0.15s;
}
details[open] > .list-summary::before {
  transform: rotate(90deg);
}
.list-copy {
  padding: 4px 10px;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--gold-deep);
  background: rgba(232, 179, 65, 0.12);
  border: 1px solid rgba(232, 179, 65, 0.25);
  border-radius: 4px;
  cursor: pointer;
}
.list-copy:hover {
  background: rgba(232, 179, 65, 0.2);
}
.list-body {
  padding: 0 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.list-group-name {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--pitch);
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}
.list-group-codes {
  font-size: 11px;
  color: var(--ink-soft);
  line-height: 1.6;
  word-break: break-word;
}
.list-toast {
  text-align: center;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--gold-deep);
  padding: 6px;
}

.cta {
  text-align: center;
  margin-top: 20px;
}
.cta-btn {
  width: 100%;
  padding: 14px 0;
  background: var(--pitch);
  color: var(--paper);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.05em;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.cta-btn:hover {
  background: var(--pitch-deep);
}
.share-btn {
  width: 100%;
  padding: 12px 0;
  margin-bottom: 10px;
  background: transparent;
  border: 1.5px solid var(--pitch);
  color: var(--pitch);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.15s;
}
.share-btn:hover {
  background: rgba(7, 32, 25, 0.05);
}
.share-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cta-sub {
  font-size: 11px;
  color: var(--ink-soft);
  font-style: italic;
  line-height: 1.6;
  margin-top: 12px;
}

.compare-btn {
  width: 100%;
  padding: 12px 0;
  margin-top: 8px;
  background: transparent;
  border: 1.5px solid var(--gold);
  color: var(--gold-deep);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.05em;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.compare-btn:hover {
  background: rgba(232, 179, 65, 0.08);
}

.compare-row {
  margin-top: 10px;
  text-align: center;
}
.compare-link {
  background: none;
  border: none;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-soft);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.compare-link:hover {
  color: var(--pitch);
}
.compare-form {
  display: flex;
  gap: 6px;
}
.compare-input {
  flex: 1;
  padding: 8px 10px;
  font-family: var(--mono);
  font-size: 12px;
  background: var(--paper);
  border: 1.5px solid var(--paper-deep);
  border-radius: 6px;
  color: var(--pitch);
}
.compare-input::placeholder {
  color: var(--ink-soft);
}
.compare-go {
  padding: 8px 14px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  background: var(--gold);
  color: var(--pitch-deep);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.compare-go:disabled {
  opacity: 0.4;
  cursor: default;
}

.footer {
  text-align: center;
  margin-top: 18px;
}
.brand {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-soft);
  text-decoration: none;
}
.brand span {
  color: var(--gold);
  margin-right: 4px;
}
</style>
