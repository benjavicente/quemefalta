<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useTradeMatches, type TradeMatch } from '@/composables/useTradeMatches';
import { useMeta } from '@/composables/useMeta';
import { TOTAL_STICKERS } from '@/lib/albumData';
import { track } from '@/lib/analytics';

const router = useRouter();
const { profile: myProfile } = useAuth();
const { matches, loading, loaded, error, load } = useTradeMatches();

useMeta(computed(() => ({ title: 'Con quién cambiar cerca tuyo — QueMeFalta' })));

const usefulMatches = computed(() => matches.value.filter((m) => m.their_dupes_for_me > 0));
const charityMatches = computed(() =>
  matches.value.filter((m) => m.their_dupes_for_me === 0 && m.my_dupes_for_them > 0),
);

function pct(owned: number): number {
  return Math.round((owned / TOTAL_STICKERS) * 100 * 10) / 10;
}

function initialOf(m: TradeMatch): string {
  const name = m.display_name || m.username || '?';
  return name.trim().charAt(0).toUpperCase();
}

function nameOf(m: TradeMatch): string {
  return m.display_name?.trim() || m.username;
}

function goToTrade(m: TradeMatch) {
  if (!myProfile.value?.username) {
    router.push(`/u/${m.username}`);
    return;
  }
  track('click_trade_match', {
    target: m.username,
    their_for_me: m.their_dupes_for_me,
    my_for_them: m.my_dupes_for_them,
  });
  router.push(`/intercambio/${myProfile.value.username}/${m.username}`);
}

function handleRefresh() {
  load(true);
}

onMounted(() => {
  track('view_trade_matches');
  load();
});
</script>

<template>
  <div class="tm-wrap">
    <header class="tm-header">
      <button type="button" class="tm-back" aria-label="Volver" @click="router.back()">‹</button>
      <div class="tm-title-wrap">
        <h1 class="tm-title">Con quién cambiar cerca tuyo</h1>
        <p class="tm-sub">Usuarios con láminas que te sirven, o a los que les sirven las tuyas.</p>
      </div>
      <button
        type="button"
        class="tm-refresh"
        :disabled="loading"
        aria-label="Actualizar lista"
        @click="handleRefresh"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </header>

    <div v-if="error" class="tm-error" role="alert">
      {{ error }}
      <button class="tm-error-btn" @click="handleRefresh">Reintentar</button>
    </div>

    <ul v-else-if="loading && !loaded" class="tm-list" aria-busy="true">
      <li v-for="i in 5" :key="i" class="tm-card tm-card-skel">
        <div class="tm-avatar tm-skel-block" />
        <div class="tm-info">
          <div class="tm-skel-line tm-skel-line-name" />
          <div class="tm-skel-line tm-skel-line-meta" />
        </div>
      </li>
    </ul>

    <div v-else-if="loaded && matches.length === 0" class="tm-empty">
      <p>Todavía no hay matches.</p>
      <p class="tm-empty-sub">
        Cuando otros usuarios marquen sus repetidas vas a verlos acá ordenados por cuánto te sirven
        sus láminas.
      </p>
    </div>

    <template v-else>
      <section v-if="usefulMatches.length > 0" class="tm-section">
        <h2 class="tm-section-title">Cambio mutuo</h2>
        <ul class="tm-list">
          <li v-for="m in usefulMatches" :key="m.user_id" class="tm-card">
            <button
              type="button"
              class="tm-card-main"
              :aria-label="`Comparar con ${nameOf(m)}`"
              @click="goToTrade(m)"
            >
              <img
                v-if="m.avatar_url"
                class="tm-avatar"
                :src="m.avatar_url"
                :alt="nameOf(m)"
                referrerpolicy="no-referrer"
              />
              <div v-else class="tm-avatar tm-avatar-fallback">{{ initialOf(m) }}</div>

              <div class="tm-info">
                <div class="tm-name-row">
                  <span class="tm-name">{{ nameOf(m) }}</span>
                  <span class="tm-pct">{{ pct(m.owned_count) }}%</span>
                </div>
                <div class="tm-handle">@{{ m.username }}</div>
                <div class="tm-badges">
                  <span class="tm-badge tm-badge-mine">
                    <strong>{{ m.their_dupes_for_me }}</strong> te sirven
                  </span>
                  <span class="tm-badge tm-badge-theirs">
                    <strong>{{ m.my_dupes_for_them }}</strong> a él/ella
                  </span>
                </div>
              </div>

              <span class="tm-chev" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="charityMatches.length > 0" class="tm-section">
        <h2 class="tm-section-title">Solo das tú</h2>
        <ul class="tm-list">
          <li v-for="m in charityMatches" :key="m.user_id" class="tm-card tm-card-charity">
            <button
              type="button"
              class="tm-card-main"
              :aria-label="`Comparar con ${nameOf(m)}`"
              @click="goToTrade(m)"
            >
              <img
                v-if="m.avatar_url"
                class="tm-avatar"
                :src="m.avatar_url"
                :alt="nameOf(m)"
                referrerpolicy="no-referrer"
              />
              <div v-else class="tm-avatar tm-avatar-fallback">{{ initialOf(m) }}</div>

              <div class="tm-info">
                <div class="tm-name-row">
                  <span class="tm-name">{{ nameOf(m) }}</span>
                  <span class="tm-pct">{{ pct(m.owned_count) }}%</span>
                </div>
                <div class="tm-handle">@{{ m.username }}</div>
                <div class="tm-badges">
                  <span class="tm-badge tm-badge-theirs">
                    <strong>{{ m.my_dupes_for_them }}</strong> a él/ella
                  </span>
                </div>
              </div>

              <span class="tm-chev" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tm-wrap {
  padding: calc(14px + env(safe-area-inset-top)) clamp(14px, 3vw, 28px)
    calc(40px + env(safe-area-inset-bottom));
  max-width: 720px;
  margin: 0 auto;
  color: var(--chalk);
}

.tm-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.tm-back {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.tm-back:hover {
  background: rgba(246, 241, 225, 0.04);
}
.tm-title-wrap {
  flex: 1;
  min-width: 0;
}
.tm-title {
  font-family: var(--display);
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
  letter-spacing: 0.02em;
  color: var(--gold);
}
.tm-sub {
  font-size: 12px;
  color: rgba(246, 241, 225, 0.55);
  margin: 2px 0 0;
  line-height: 1.4;
}
.tm-refresh {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--chalk-dim);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tm-refresh:hover:not(:disabled) {
  background: rgba(246, 241, 225, 0.04);
  color: var(--chalk);
}
.tm-refresh:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tm-error {
  padding: 14px;
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.4);
  border-radius: 8px;
  color: var(--coral);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tm-error-btn {
  align-self: flex-start;
  background: transparent;
  border: 1px solid var(--coral);
  color: var(--coral);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit;
  cursor: pointer;
  font-size: 12px;
}

.tm-empty {
  padding: 40px 20px;
  text-align: center;
  color: rgba(246, 241, 225, 0.55);
  font-size: 14px;
  line-height: 1.5;
}
.tm-empty-sub {
  font-size: 12px;
  margin-top: 8px;
}

.tm-section {
  margin-bottom: 24px;
}
.tm-section:last-child {
  margin-bottom: 0;
}
.tm-section-title {
  font-family: var(--display);
  font-size: 16px;
  margin: 0 0 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--gold);
}
.tm-card-charity {
  opacity: 0.75;
}
.tm-card-charity:hover,
.tm-card-charity:focus-within {
  opacity: 1;
}

.tm-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tm-card {
  background: rgba(246, 241, 225, 0.03);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.tm-card-main {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.tm-card-main:hover {
  background: rgba(246, 241, 225, 0.04);
}
.tm-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  background: rgba(246, 241, 225, 0.08);
}
.tm-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: 18px;
  color: var(--gold);
  background: rgba(232, 179, 65, 0.1);
}

.tm-info {
  flex: 1;
  min-width: 0;
}
.tm-name-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.tm-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--chalk);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.tm-pct {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--gold);
  flex-shrink: 0;
}
.tm-handle {
  font-family: var(--mono);
  font-size: 11px;
  color: rgba(246, 241, 225, 0.5);
  margin-top: 1px;
}
.tm-badges {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.tm-badge {
  font-family: var(--mono);
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 5px;
  background: rgba(246, 241, 225, 0.05);
  border: 1px solid var(--line);
  color: var(--chalk-dim);
  white-space: nowrap;
}
.tm-badge strong {
  color: var(--chalk);
}
.tm-badge-mine {
  border-color: rgba(77, 208, 161, 0.35);
  background: rgba(77, 208, 161, 0.08);
  color: var(--mint);
}
.tm-badge-mine strong {
  color: var(--mint);
}
.tm-badge-theirs {
  border-color: rgba(232, 179, 65, 0.3);
  background: rgba(232, 179, 65, 0.06);
  color: var(--gold);
}
.tm-badge-theirs strong {
  color: var(--gold);
}

.tm-chev {
  font-size: 22px;
  color: rgba(246, 241, 225, 0.4);
  flex-shrink: 0;
  line-height: 1;
}

/* Skeleton loading */
.tm-card-skel {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.tm-skel-block,
.tm-skel-line {
  background: linear-gradient(
    90deg,
    rgba(246, 241, 225, 0.04),
    rgba(246, 241, 225, 0.1),
    rgba(246, 241, 225, 0.04)
  );
  background-size: 200% 100%;
  animation: tm-shimmer 1.4s linear infinite;
  border-radius: 6px;
}
.tm-skel-line {
  height: 12px;
}
.tm-skel-line-name {
  width: 60%;
  margin-bottom: 6px;
}
.tm-skel-line-meta {
  width: 40%;
}
@keyframes tm-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
