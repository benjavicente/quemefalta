<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { profile, updateProfile } = useAuth();

const username = ref('');
const error = ref('');
const saving = ref(false);

const firstName = computed(() => {
  return profile.value?.display_name?.split(' ')[0] ?? 'colega';
});

const previewUsername = computed(() => {
  return username.value || 'tu_username';
});

async function submit() {
  error.value = '';

  const cleaned = username.value.toLowerCase().trim();

  if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
    error.value = '3-20 caracteres, solo letras minúsculas, números y _';
    return;
  }

  saving.value = true;

  // Verificar si está disponible (puede tirar 23505 si ya existe)
  try {
    await updateProfile({ username: cleaned, onboarded: true });
    router.replace('/album');
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '23505') {
      error.value = 'Ese username ya está tomado. Probá otro.';
    } else {
      error.value = err.message || 'Error al guardar';
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="onboard-wrap">
    <div class="onboard-card">
      <div v-if="profile?.avatar_url" class="avatar">
        <img :src="profile.avatar_url" :alt="firstName" />
      </div>
      <div class="greet">¡HOLA, {{ firstName.toUpperCase() }}!</div>
      <h2 class="title">Elige tu username</h2>
      <p class="desc">Es tu identidad pública. Será parte de la URL de tu perfil:</p>
      <div class="url-preview">
        quemefalta.app/u/<span>{{ previewUsername }}</span>
      </div>

      <input
        v-model="username"
        class="input"
        type="text"
        aria-label="Nombre de usuario"
        placeholder="ej: tony"
        autocapitalize="off"
        autocorrect="off"
        @keydown.enter="submit"
      />
      <div v-if="error" class="error" role="alert">{{ error }}</div>
      <button class="btn-solid" :disabled="saving" @click="submit">
        {{ saving ? 'GUARDANDO...' : 'CONTINUAR' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboard-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.onboard-card {
  width: 100%;
  max-width: 380px;
  background: var(--paper);
  color: var(--pitch-deep);
  padding: 32px 26px;
  border-radius: 4px;
  box-shadow: var(--shadow);
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.avatar {
  width: 64px;
  height: 64px;
  margin: 0 auto 14px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--gold);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}
.avatar img {
  width: 100%;
  height: 100%;
}
.greet {
  text-align: center;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  color: rgba(10, 61, 46, 0.6);
  margin-bottom: 4px;
}
.title {
  font-family: var(--display);
  font-size: 36px;
  letter-spacing: 0.04em;
  text-align: center;
  color: var(--pitch);
  line-height: 1;
  margin: 0;
}
.desc {
  text-align: center;
  font-size: 13px;
  color: rgba(10, 61, 46, 0.7);
  margin: 12px 0 16px;
  line-height: 1.5;
}
.url-preview {
  background: rgba(10, 61, 46, 0.05);
  padding: 10px 12px;
  border-radius: 2px;
  font-family: var(--mono);
  font-size: 12px;
  color: rgba(10, 61, 46, 0.6);
  text-align: center;
  margin-bottom: 18px;
  border: 1px dashed rgba(10, 61, 46, 0.2);
}
.url-preview span {
  color: var(--pitch);
  font-weight: 700;
}
.input {
  width: 100%;
  padding: 14px 12px;
  font-size: 16px;
  font-family: inherit;
  background: rgba(10, 61, 46, 0.04);
  border: 1px solid rgba(10, 61, 46, 0.15);
  border-radius: 2px;
  color: var(--pitch-deep);
  outline: none;
  transition: border-color 0.15s;
}
.input:focus {
  border-color: var(--pitch);
}
.error {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(200, 54, 43, 0.08);
  border-left: 3px solid var(--red);
  color: var(--red);
  font-size: 12px;
  font-weight: 500;
}
.btn-solid {
  width: 100%;
  margin-top: 18px;
  padding: 16px;
  background: var(--pitch);
  color: var(--chalk);
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.18em;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.btn-solid:hover:not(:disabled) {
  background: var(--pitch-deep);
}
.btn-solid:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
