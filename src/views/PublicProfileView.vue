<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase, ensureFreshSession } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { TOTAL_STICKERS } from '@/lib/albumData';

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
const { user } = useAuth();

const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const notFound = ref(false);

const username = computed(() => route.params.username as string);

const isOwnProfile = computed(() => {
  return user.value && profile.value && user.value.id === profile.value.id;
});

const stats = computed(() => {
  if (!profile.value) return { pct: 0, owned: 0, missing: 0, dupes: 0 };
  const owned = profile.value.owned_count;
  return {
    pct: Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10,
    owned,
    missing: TOTAL_STICKERS - owned,
    dupes: profile.value.dupes_count,
  };
});

const firstName = computed(() => {
  return profile.value?.display_name?.split(' ')[0] ?? profile.value?.username;
});

const userInitial = computed(() => {
  const name = profile.value?.display_name || profile.value?.username || '?';
  return name.charAt(0).toUpperCase();
});

onMounted(async () => {
  loading.value = true;

  await ensureFreshSession();

  try {
    const { data, error } = await supabase
      .from('public_album_stats')
      .select('*')
      .eq('username', username.value)
      .maybeSingle();

    if (error) {
      console.error('Error loading public profile:', error);
      notFound.value = true;
    } else if (!data) {
      notFound.value = true;
    } else {
      profile.value = data as PublicProfile;
    }
  } catch {
    console.error('Public profile request timed out');
    notFound.value = true;
  }

  loading.value = false;
});

function goToMyAlbum() {
  if (user.value) {
    router.push('/album');
  } else {
    router.push('/auth');
  }
}
</script>

<template>
  <div class="public-wrap">
    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
      <div class="loading-mark">★</div>
      <div>Cargando perfil...</div>
    </div>

    <!-- NOT FOUND -->
    <div v-else-if="notFound" class="not-found">
      <div class="nf-mark">🤷</div>
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

    <!-- PROFILE CARD -->
    <div v-else-if="profile" class="card">
      <div class="card-star">★</div>

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
      </div>

      <!-- CTA -->
      <div class="cta">
        <button v-if="isOwnProfile" class="cta-btn" @click="router.push('/album')">
          Volver a mi álbum
        </button>
        <template v-else>
          <button class="cta-btn" @click="goToMyAlbum">
            {{ user ? 'Ver mi álbum' : 'Crear mi álbum' }}
          </button>
          <div class="cta-sub">
            ¿Tienes láminas que canjear con {{ firstName }}? Contáctalo directamente.
          </div>
        </template>
      </div>

      <div class="footer">
        <a href="/" class="brand"><span>★</span> QueMeFalta</a>
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
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
  padding: 16px 0;
  border-top: 1px dashed var(--paper-deep);
  border-bottom: 1px dashed var(--paper-deep);
}
.stat-num {
  font-family: var(--display);
  font-size: 30px;
  color: var(--pitch);
  line-height: 1;
}
.stat-num-coral {
  color: var(--coral);
}
.stat-lbl {
  font-family: var(--mono);
  font-size: 9px;
  color: var(--ink-soft);
  letter-spacing: 0.15em;
  margin-top: 4px;
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
.cta-sub {
  font-size: 11px;
  color: var(--ink-soft);
  font-style: italic;
  line-height: 1.6;
  margin-top: 12px;
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
