<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useExchange } from '@/composables/useExchange';
import { useAuth } from '@/composables/useAuth';
import { useMeta } from '@/composables/useMeta';
import { formatExchangeList } from '@/lib/exchangeUtils';
import { teamFlagEmoji } from '@/lib/teamFlagEmoji';
import { supabase, withAuthRetry } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import WhatsAppModal from '@/components/WhatsAppModal.vue';

const route = useRoute();
const { user, profile: myProfile } = useAuth();

const userA = computed(() => route.params.userA as string);
const userB = computed(() => route.params.userB as string);

const showWhatsAppModal = ref(false);

// "Soy yo" sobre cada slot — sirve para decidir cuándo mostrar el CTA inline
// de "Agregar WhatsApp" en vez de la pill verde de contacto.
const isMeA = computed(() => !!myProfile.value && myProfile.value.username === userA.value);
const isMeB = computed(() => !!myProfile.value && myProfile.value.username === userB.value);

function openWhatsAppModal() {
  showWhatsAppModal.value = true;
}

async function onWhatsAppSaved() {
  showWhatsAppModal.value = false;
  await loadWhatsAppNumbers();
}

const whatsappA = ref<string | null>(null);
const whatsappB = ref<string | null>(null);

function buildHref(num: string | null): string | null {
  if (!num) return null;
  const digits = num.replace(/[^\d]/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

const whatsappHrefA = computed(() => buildHref(whatsappA.value));
const whatsappHrefB = computed(() => buildHref(whatsappB.value));

async function loadWhatsAppNumbers() {
  if (!user.value) {
    whatsappA.value = null;
    whatsappB.value = null;
    return;
  }
  const [{ data: dataA }, { data: dataB }] = await Promise.all([
    withAuthRetry(() => supabase.rpc('get_profile_phone', { p_username: userA.value })),
    withAuthRetry(() => supabase.rpc('get_profile_phone', { p_username: userB.value })),
  ]);
  whatsappA.value = typeof dataA === 'string' && dataA.trim() ? dataA : null;
  whatsappB.value = typeof dataB === 'string' && dataB.trim() ? dataB : null;
}

function handleWhatsAppClick(target: string) {
  track('contact_whatsapp', { from: 'exchange', target });
}

const { loading, error, profileA, profileB, statsA, statsB, exchange, load } = useExchange(
  userA,
  userB,
);

const copied = ref('');

function showCopied(msg: string) {
  copied.value = msg;
  setTimeout(() => {
    copied.value = '';
  }, 2000);
}

const nameA = computed(
  () => profileA.value?.display_name?.trim() || profileA.value?.username || userA.value,
);
const nameB = computed(
  () => profileB.value?.display_name?.trim() || profileB.value?.username || userB.value,
);

const metaInfo = computed(() => {
  if (!profileA.value || !profileB.value || !exchange.value) {
    return { title: 'Intercambio de láminas — QueMeFalta' };
  }
  return {
    title: `${nameA.value} vs ${nameB.value} — Intercambio — QueMeFalta`,
    description: `${nameA.value} le puede dar ${exchange.value.aGivesBCount} láminas a ${nameB.value}. ${nameB.value} le puede dar ${exchange.value.bGivesACount} a ${nameA.value}.`,
  };
});

useMeta(metaInfo);

function initialOf(profile: { display_name: string | null; username: string }) {
  const name = profile.display_name || profile.username;
  return name.charAt(0).toUpperCase();
}

function copyAGivesB() {
  if (!exchange.value) return;
  const text = formatExchangeList(
    nameA.value,
    nameB.value,
    exchange.value.aGivesB,
    exchange.value.aGivesBCount,
  );
  navigator.clipboard?.writeText(text).then(() => showCopied('Lista copiada'));
}

function copyBGivesA() {
  if (!exchange.value) return;
  const text = formatExchangeList(
    nameB.value,
    nameA.value,
    exchange.value.bGivesA,
    exchange.value.bGivesACount,
  );
  navigator.clipboard?.writeText(text).then(() => showCopied('Lista copiada'));
}

function copyAll() {
  if (!exchange.value) return;
  const parts: string[] = [];
  if (exchange.value.aGivesBCount > 0) {
    parts.push(
      formatExchangeList(
        nameA.value,
        nameB.value,
        exchange.value.aGivesB,
        exchange.value.aGivesBCount,
      ),
    );
  }
  if (exchange.value.bGivesACount > 0) {
    parts.push(
      formatExchangeList(
        nameB.value,
        nameA.value,
        exchange.value.bGivesA,
        exchange.value.bGivesACount,
      ),
    );
  }
  const text = parts.join('\n\n');
  navigator.clipboard?.writeText(text).then(() => showCopied('Intercambio completo copiado'));
}

function shareComparison() {
  const url = globalThis.location.href;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    navigator.share({ title: metaInfo.value.title, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => showCopied('Link copiado'));
  }
}

onMounted(async () => {
  track('view_exchange');
  await load();
  await loadWhatsAppNumbers();
});
</script>

<template>
  <div class="exchange-wrap">
    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
      <div class="loading-mark">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
          />
        </svg>
      </div>
      <div>Calculando intercambio...</div>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="not-found">
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
      <h1>No se pudo comparar</h1>
      <p>{{ error }}</p>
      <a href="/" class="btn-back">Ir a QueMeFalta</a>
    </div>

    <!-- COMPARISON -->
    <div v-else-if="profileA && profileB && exchange" class="card">
      <!-- Decorative star -->
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

      <div class="title">INTERCAMBIO</div>

      <!-- Two profile mini-cards -->
      <div class="profiles">
        <div class="profile-col">
          <a :href="`/u/${profileA.username}`" class="profile-mini">
            <div v-if="profileA.avatar_url" class="mini-avatar">
              <img :src="profileA.avatar_url" :alt="nameA" />
            </div>
            <div v-else class="mini-avatar mini-avatar-ph">{{ initialOf(profileA) }}</div>
            <div class="mini-name">{{ nameA }}</div>
            <div class="mini-handle">@{{ profileA.username }}</div>
            <div v-if="statsA" class="mini-stats">
              <span>{{ statsA.pct }}%</span>
              <span class="mini-dupes">{{ statsA.dupes }} rep.</span>
            </div>
          </a>
          <a
            v-if="whatsappHrefA"
            :href="whatsappHrefA"
            target="_blank"
            rel="noopener noreferrer"
            class="wa-pill"
            :aria-label="`Escribir a ${nameA} por WhatsApp`"
            @click="handleWhatsAppClick(profileA.username)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a11.93 11.93 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411"
              />
            </svg>
            WhatsApp
          </a>
          <button
            v-else-if="isMeA"
            type="button"
            class="wa-add-btn"
            @click="openWhatsAppModal"
          >
            + Agregar tu WhatsApp
          </button>
        </div>

        <div class="swap-icon" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--gold)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>

        <div class="profile-col">
          <a :href="`/u/${profileB.username}`" class="profile-mini">
            <div v-if="profileB.avatar_url" class="mini-avatar">
              <img :src="profileB.avatar_url" :alt="nameB" />
            </div>
            <div v-else class="mini-avatar mini-avatar-ph">{{ initialOf(profileB) }}</div>
            <div class="mini-name">{{ nameB }}</div>
            <div class="mini-handle">@{{ profileB.username }}</div>
            <div v-if="statsB" class="mini-stats">
              <span>{{ statsB.pct }}%</span>
              <span class="mini-dupes">{{ statsB.dupes }} rep.</span>
            </div>
          </a>
          <a
            v-if="whatsappHrefB"
            :href="whatsappHrefB"
            target="_blank"
            rel="noopener noreferrer"
            class="wa-pill"
            :aria-label="`Escribir a ${nameB} por WhatsApp`"
            @click="handleWhatsAppClick(profileB.username)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a11.93 11.93 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411"
              />
            </svg>
            WhatsApp
          </a>
          <button
            v-else-if="isMeB"
            type="button"
            class="wa-add-btn"
            @click="openWhatsAppModal"
          >
            + Agregar tu WhatsApp
          </button>
        </div>
      </div>

      <!-- Exchange lists -->
      <div v-if="exchange.aGivesBCount > 0 || exchange.bGivesACount > 0" class="lists">
        <!-- A gives B -->
        <details v-if="exchange.aGivesBCount > 0" class="list-detail">
          <summary class="list-summary">
            <span>{{ nameA }} le da a {{ nameB }} ({{ exchange.aGivesBCount }})</span>
            <button class="list-copy" @click.prevent="copyAGivesB">Copiar</button>
          </summary>
          <div class="list-body">
            <div v-for="g in exchange.aGivesB" :key="g.section.id" class="list-group">
              <div class="list-group-name">
                {{ teamFlagEmoji(g.section.code) }} {{ g.section.name }}
              </div>
              <div class="list-group-codes">
                {{
                  g.items
                    .map((i) => (i.dupeCount > 1 ? `${i.code} (+${i.dupeCount})` : i.code))
                    .join(', ')
                }}
              </div>
            </div>
          </div>
        </details>

        <!-- B gives A -->
        <details v-if="exchange.bGivesACount > 0" class="list-detail">
          <summary class="list-summary">
            <span>{{ nameB }} le da a {{ nameA }} ({{ exchange.bGivesACount }})</span>
            <button class="list-copy" @click.prevent="copyBGivesA">Copiar</button>
          </summary>
          <div class="list-body">
            <div v-for="g in exchange.bGivesA" :key="g.section.id" class="list-group">
              <div class="list-group-name">
                {{ teamFlagEmoji(g.section.code) }} {{ g.section.name }}
              </div>
              <div class="list-group-codes">
                {{
                  g.items
                    .map((i) => (i.dupeCount > 1 ? `${i.code} (+${i.dupeCount})` : i.code))
                    .join(', ')
                }}
              </div>
            </div>
          </div>
        </details>

        <!-- Copy toast -->
        <div v-if="copied" class="list-toast">{{ copied }}</div>

        <!-- Action buttons -->
        <div class="actions">
          <button class="action-btn" @click="copyAll">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copiar todo
          </button>
          <button class="action-btn" @click="shareComparison">
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
            Compartir
          </button>
        </div>
      </div>

      <!-- Empty exchange -->
      <div v-else class="empty">
        <div class="empty-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--chalk-dim)"
            stroke-width="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="15" x2="16" y2="15" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </div>
        <p class="empty-text">No hay láminas para intercambiar.</p>
        <p class="empty-sub">Ninguno tiene repetidas que al otro le falten.</p>
      </div>

      <!-- Footer -->
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

    <WhatsAppModal
      v-if="showWhatsAppModal"
      @close="showWhatsAppModal = false"
      @saved="onWhatsAppSaved"
    />
  </div>
</template>

<style scoped>
.exchange-wrap {
  min-height: 100vh;
  padding: calc(24px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right))
    calc(24px + env(safe-area-inset-bottom)) calc(18px + env(safe-area-inset-left));
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: radial-gradient(
    ellipse at 50% 0%,
    rgba(232, 179, 65, 0.08) 0%,
    transparent 60%
  );
}

/* Loading & error — same as PublicProfileView */
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
  text-decoration: none;
}

/* Card */
.card {
  width: 100%;
  max-width: 520px;
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
  pointer-events: none;
}
.title {
  font-family: var(--display);
  font-size: 24px;
  letter-spacing: 0.08em;
  text-align: center;
  color: var(--pitch);
  margin-bottom: 20px;
}

/* Two profile mini-cards */
.profiles {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 12px;
  margin-bottom: 22px;
}
.profile-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.profile-mini {
  flex: 1;
  min-width: 0;
  text-align: center;
  text-decoration: none;
  color: inherit;
  padding: 14px 8px;
  border: 1px solid var(--paper-deep);
  border-radius: 10px;
  transition: box-shadow 0.15s;
}
.wa-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 8px;
  background: #25d366;
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: background 0.15s;
}
.wa-pill:hover {
  background: #1da851;
}
.wa-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
  background: transparent;
  border: 1px dashed var(--paper-deep);
  border-radius: 8px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  cursor: pointer;
  transition:
    border-color 0.15s,
    color 0.15s;
}
.wa-add-btn:hover {
  border-color: #25d366;
  color: #25d366;
}
.profile-mini:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.mini-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  overflow: hidden;
  margin: 0 auto 8px;
}
.mini-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mini-avatar-ph {
  background: var(--coral);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-size: 24px;
}
.mini-name {
  font-family: var(--display);
  font-size: 16px;
  color: var(--pitch);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-handle {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-soft);
  letter-spacing: 0.05em;
  margin-top: 2px;
}
.mini-stats {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}
.mini-stats span:first-child {
  font-weight: 700;
  color: var(--pitch);
}
.mini-dupes {
  color: var(--coral);
}
.swap-icon {
  flex-shrink: 0;
}

/* Lists — same patterns as PublicProfileView */
.lists {
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
  content: '\25B6';
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

/* Actions */
.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
  background: var(--pitch);
  color: var(--paper);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.action-btn:hover {
  background: var(--pitch-deep);
}

/* Empty state */
.empty {
  text-align: center;
  padding: 30px 0 10px;
}
.empty-icon {
  margin-bottom: 12px;
}
.empty-text {
  font-family: var(--display);
  font-size: 18px;
  color: var(--pitch);
  margin: 0;
}
.empty-sub {
  font-size: 12px;
  color: var(--ink-soft);
  margin: 6px 0 0;
}

/* Footer */
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
</style>
