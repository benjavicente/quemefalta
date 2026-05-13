<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useShare } from '@/composables/useShare';
import type { Profile } from '@/types/app';

const props = defineProps<{
  profile: Profile;
  pct: number;
}>();

defineEmits<{
  close: [];
}>();

const {
  share,
  copyOnly,
  whatsappLink,
  linkedinLink,
  emailLink,
  isNativeShareAvailable,
  openExternalUrl,
} = useShare();

const router = useRouter();
const justCopied = ref(false);
const showCompare = ref(false);
const compareUser = ref('');

const url = computed(() => {
  return `${globalThis.location.origin}/u/${props.profile.username}`;
});

const shareText = computed(() => {
  return `Mira mi álbum del Mundial: tengo ${props.pct}% completo. ¿Tienes láminas que cambiar?`;
});

const shareTitle = computed(() => {
  return `Mi álbum del Mundial — ${props.pct}% completo`;
});

async function handleCopy() {
  const ok = await copyOnly(url.value);
  if (ok) {
    justCopied.value = true;
    setTimeout(() => (justCopied.value = false), 1800);
  }
}

async function handleNativeShare() {
  await share({
    title: shareTitle.value,
    text: shareText.value,
    url: url.value,
  });
}

/** LinkedIn web share always hits login; native share sheet lets users pick the LinkedIn app on mobile. */
async function openLinkedInShare() {
  const webUrl = linkedinLink(url.value);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: shareTitle.value,
        text: `${shareText.value}\n${url.value}`,
        url: url.value,
      });
      return;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  openExternalUrl(webUrl);
}

function viewPublic() {
  globalThis.open(url.value, '_blank');
}

function goCompare() {
  const other = compareUser.value.trim().replace(/^@/, '');
  if (other && other !== props.profile.username) {
    router.push(`/intercambio/${props.profile.username}/${other}`);
  }
}
</script>

<template>
  <div class="modal-bg" @click="$emit('close')" @keydown.escape="$emit('close')">
    <div class="modal" @click.stop>
      <div class="modal-title">COMPARTIR MI ÁLBUM</div>
      <p class="modal-desc">
        Tu progreso es público. Los demás ven tu porcentaje y stats, pero
        <strong>no qué láminas específicas tienes</strong>.
      </p>

      <!-- URL preview -->
      <div class="url-row">
        <span class="url-text">{{ url.replace('https://', '').replace('http://', '') }}</span>
        <button class="url-copy" @click="handleCopy">
          {{ justCopied ? '✓ Copiado' : 'Copiar' }}
        </button>
      </div>

      <!-- Native share / main CTA -->
      <button
        class="share-main"
        @click="isNativeShareAvailable ? handleNativeShare() : handleCopy()"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Compartir
      </button>

      <!-- Social grid -->
      <div class="share-grid">
        <a
          :href="whatsappLink(shareText, url)"
          rel="noopener noreferrer"
          class="social-btn"
          @click.prevent="openExternalUrl(whatsappLink(shareText, url))"
        >
          <div class="social-icon" style="background: var(--mint)" />
          <span>WhatsApp</span>
        </a>
        <a
          :href="linkedinLink(url)"
          rel="noopener noreferrer"
          class="social-btn"
          @click.prevent="openLinkedInShare()"
        >
          <div class="social-icon" style="background: var(--pitch)" />
          <span>LinkedIn</span>
        </a>
        <a :href="emailLink(shareTitle, shareText + '\n\n' + url)" class="social-btn">
          <div class="social-icon" style="background: var(--coral)" />
          <span>Email</span>
        </a>
      </div>

      <button class="preview-btn" @click="viewPublic">👁 Ver cómo se ve mi perfil público</button>

      <!-- Compare with someone -->
      <button v-if="!showCompare" class="preview-btn" @click="showCompare = true">
        Comparar con otro perfil
      </button>
      <form v-else class="compare-form" @submit.prevent="goCompare">
        <input
          v-model="compareUser"
          class="compare-input"
          placeholder="@username del otro"
          autocomplete="off"
          autocapitalize="off"
        />
        <button type="submit" class="compare-go" :disabled="!compareUser.trim()">Ir</button>
      </form>

      <button class="close-btn" @click="$emit('close')">CERRAR</button>
    </div>
  </div>
</template>

<style scoped>
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 32, 0.75);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}
.modal {
  background: var(--paper);
  color: var(--ink);
  width: 100%;
  max-width: 420px;
  border-radius: 14px;
  padding: 26px 22px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  animation: popIn 0.2s ease-out;
  font-family: var(--body);
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes popIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.modal-title {
  font-family: var(--display);
  font-size: 26px;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
  color: var(--pitch);
}
.modal-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0 0 18px;
}
.modal-desc strong {
  color: var(--ink);
}

.url-row {
  display: flex;
  align-items: center;
  background: rgba(232, 179, 65, 0.05);
  border: 1.5px dashed var(--paper-deep);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
  gap: 10px;
}
.url-text {
  flex: 1;
  font-family: var(--mono);
  font-size: 12px;
  color: var(--pitch);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.url-copy {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--pitch);
  padding: 6px 12px;
  background: var(--paper);
  border-radius: 5px;
  border: 1px solid var(--paper-deep);
  cursor: pointer;
  font-family: inherit;
}
.url-copy:hover {
  background: var(--pitch);
  color: var(--paper);
}

.share-main {
  width: 100%;
  padding: 14px 0;
  margin-bottom: 12px;
  background: var(--pitch);
  color: var(--paper);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.share-main:hover {
  background: var(--pitch-deep);
}

.share-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}
.social-btn {
  background: var(--paper);
  border: 1px solid var(--paper-deep);
  border-radius: 8px;
  padding: 12px 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: all 0.15s;
}
.social-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.social-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}
.social-btn span {
  font-size: 11px;
  font-weight: 700;
  color: var(--pitch);
}

.preview-btn {
  width: 100%;
  padding: 12px 0;
  margin-bottom: 8px;
  background: transparent;
  border: 1px solid var(--paper-deep);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--pitch);
  cursor: pointer;
  font-family: inherit;
}
.preview-btn:hover {
  background: rgba(0, 0, 0, 0.03);
}

.compare-form {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.compare-input {
  flex: 1;
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 12px;
  background: var(--paper);
  border: 1.5px solid var(--paper-deep);
  border-radius: 6px;
  color: var(--pitch);
}
.compare-input::placeholder { color: var(--ink-soft); }
.compare-go {
  padding: 10px 16px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  background: var(--gold);
  color: var(--pitch-deep);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.compare-go:disabled { opacity: 0.4; cursor: default; }

.close-btn {
  width: 100%;
  padding: 8px 0;
  background: transparent;
  border: none;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  cursor: pointer;
}
.close-btn:hover {
  color: var(--pitch);
}
</style>
