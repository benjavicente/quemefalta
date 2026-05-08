import { ref } from 'vue';

interface ShareData {
  title: string;
  text: string;
  url: string;
}

export function useShare() {
  const lastResult = ref<'shared' | 'copied' | 'error' | null>(null);
  const errorMessage = ref('');

  const isNativeShareAvailable =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function share(data: ShareData): Promise<'shared' | 'copied' | 'error'> {
    errorMessage.value = '';

    // En mobile: usar el share sheet nativo
    if (isNativeShareAvailable) {
      try {
        await navigator.share(data);
        lastResult.value = 'shared';
        return 'shared';
      } catch (e: unknown) {
        // El usuario canceló — no es error
        if (e instanceof DOMException && e.name === 'AbortError') {
          lastResult.value = null;
          return 'error';
        }
        // Si falla por otro motivo, caemos al copy-link
        console.warn('navigator.share falló, fallback a copy:', e);
      }
    }

    // En desktop o fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(data.url);
      lastResult.value = 'copied';
      return 'copied';
    } catch (e: unknown) {
      lastResult.value = 'error';
      errorMessage.value = e instanceof Error ? e.message : 'No se pudo copiar';
      return 'error';
    }
  }

  async function copyOnly(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function whatsappLink(text: string, url: string): string {
    const msg = encodeURIComponent(`${text}\n${url}`);
    return `https://wa.me/?text=${msg}`;
  }

  function linkedinLink(url: string): string {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  }

  function emailLink(subject: string, body: string): string {
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return {
    isNativeShareAvailable,
    lastResult,
    errorMessage,
    share,
    copyOnly,
    whatsappLink,
    linkedinLink,
    emailLink,
  };
}
