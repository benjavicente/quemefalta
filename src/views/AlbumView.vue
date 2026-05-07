<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

const { profile, signOut } = useAuth()

async function handleLogout() {
  await signOut()
  // El router guard se encarga de mandar al usuario a /auth
  window.location.href = '/auth'
}
</script>

<template>
  <div class="album-wrap">
    <header class="hdr">
      <div class="hdr-left">
        <img v-if="profile?.avatar_url" class="avatar" :src="profile.avatar_url" :alt="profile.display_name ?? ''" />
        <div>
          <div class="title">QUEMEFALTA</div>
          <div class="handle">@{{ profile?.username }}</div>
        </div>
      </div>
      <button class="logout" @click="handleLogout">SALIR</button>
    </header>

    <main class="body">
      <div class="placeholder">
        <div class="ph-mark">⚽</div>
        <h2>Bienvenido al álbum, {{ profile?.display_name?.split(' ')[0] }}</h2>
        <p>
          La auth está funcionando. Tu profile está creado.<br />
          La grilla del álbum se construye en la próxima sesión.
        </p>

        <div class="ph-info">
          <div class="ph-row">
            <span>username</span>
            <strong>{{ profile?.username }}</strong>
          </div>
          <div class="ph-row">
            <span>display name</span>
            <strong>{{ profile?.display_name }}</strong>
          </div>
          <div class="ph-row">
            <span>onboarded</span>
            <strong>{{ profile?.onboarded ? '✓' : '✗' }}</strong>
          </div>
          <div class="ph-row">
            <span>perfil público</span>
            <strong>{{ profile?.is_public ? '✓' : '✗' }}</strong>
          </div>
        </div>

        <div class="ph-foot">
          ✅ Sesión 2 completa<br />
          → Sesión 3: la grilla de stickers
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.album-wrap {
  min-height: 100vh;
}
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
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--gold);
}
.title {
  font-family: var(--display);
  font-size: 18px;
  letter-spacing: 0.1em;
  line-height: 1;
}
.handle {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--chalk-dim);
  margin-top: 2px;
}
.logout {
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
.logout:hover {
  color: var(--red);
  border-color: var(--red);
}
.body {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 20px;
}
.placeholder {
  text-align: center;
}
.ph-mark {
  font-size: 64px;
  margin-bottom: 16px;
}
.placeholder h2 {
  font-family: var(--display);
  font-size: 36px;
  letter-spacing: 0.04em;
  color: var(--gold);
  margin: 0 0 12px;
}
.placeholder p {
  font-size: 14px;
  color: var(--chalk-dim);
  line-height: 1.6;
  margin-bottom: 32px;
}
.ph-info {
  max-width: 380px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 16px 20px;
  font-family: var(--mono);
  font-size: 12px;
  text-align: left;
}
.ph-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
}
.ph-row:last-child {
  border-bottom: none;
}
.ph-row span {
  color: var(--chalk-dim);
  letter-spacing: 0.05em;
}
.ph-row strong {
  color: var(--gold);
  font-weight: 700;
}
.ph-foot {
  margin-top: 32px;
  padding: 16px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--chalk-dim);
  line-height: 1.8;
}
</style>
