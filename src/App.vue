<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from './lib/supabase'

const status = ref<'checking' | 'ok' | 'error'>('checking')
const message = ref('Conectando con Supabase...')
const details = ref('')

onMounted(async () => {
  try {
    // Probamos consultar la vista pública. Si conecta y RLS funciona,
    // retorna un array (vacío o con datos), no un error.
    const { data, error } = await supabase
      .from('public_album_stats')
      .select('username')
      .limit(1)

    if (error) {
      status.value = 'error'
      message.value = '❌ Error de conexión'
      details.value = `${error.code || 'unknown'}: ${error.message}`
      return
    }

    status.value = 'ok'
    message.value = '✅ Conectado a Supabase'
    details.value = `Filas en public_album_stats: ${data?.length ?? 0} (esperado: 0, todavía no hay usuarios)`
  } catch (e: any) {
    status.value = 'error'
    message.value = '❌ Error inesperado'
    details.value = e.message
  }
})
</script>

<template>
  <div class="health">
    <div class="mark">★</div>
    <h1>QueMeFalta</h1>
    <div class="sub">SETUP CHECK · SESIÓN 1</div>

    <div class="status" :class="status">
      {{ message }}
    </div>

    <div class="details">{{ details }}</div>

    <div class="env-info">
      <div><span>URL:</span> {{ env.url }}</div>
      <div><span>KEY:</span> {{ env.keyPrefix }}...{{ env.keySuffix }}</div>
    </div>
  </div>
</template>

<script lang="ts">
const url = import.meta.env.VITE_SUPABASE_URL || '(missing)'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const env = {
  url,
  keyPrefix: key.slice(0, 20),
  keySuffix: key.slice(-6),
}
</script>

<style scoped>
.health {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 30% 0%, rgba(245,197,66,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 100%, rgba(10,61,46,0.5) 0%, transparent 50%),
    #062318;
  color: #f4f1e8;
  font-family: system-ui, -apple-system, sans-serif;
  padding: 20px;
  text-align: center;
}
.mark {
  font-size: 56px;
  color: #f5c542;
  line-height: 1;
  margin-bottom: 10px;
}
h1 {
  font-size: 56px;
  letter-spacing: 0.04em;
  margin: 0;
  font-weight: 800;
}
.sub {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #d9d4c4;
  margin: 6px 0 32px;
  font-family: 'Courier New', monospace;
  opacity: 0.7;
}
.status {
  font-size: 18px;
  margin-bottom: 14px;
  padding: 16px 24px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid;
}
.status.checking {
  background: rgba(245,197,66,0.08);
  border-color: rgba(245,197,66,0.3);
  color: #f5c542;
}
.status.ok {
  background: rgba(80,200,120,0.08);
  border-color: rgba(80,200,120,0.3);
  color: #80e8a0;
}
.status.error {
  background: rgba(200,54,43,0.08);
  border-color: rgba(200,54,43,0.4);
  color: #ff8a80;
}
.details {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #d9d4c4;
  opacity: 0.7;
  max-width: 500px;
  word-break: break-word;
  margin-bottom: 32px;
}
.env-info {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #d9d4c4;
  opacity: 0.5;
  border-top: 1px dashed rgba(255,255,255,0.1);
  padding-top: 16px;
  text-align: left;
  width: 100%;
  max-width: 500px;
}
.env-info > div {
  margin: 4px 0;
}
.env-info span {
  color: #f5c542;
  font-weight: 600;
  margin-right: 6px;
}
</style>
