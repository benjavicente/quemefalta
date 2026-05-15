import { track as vercelTrack } from '@vercel/analytics';

// Wrapper centralizado para eventos custom de Vercel Web Analytics.
//
// - En mock mode (`VITE_MOCK=true`, ej. `npm run dev:mock`) hacemos no-op:
//   el dev local no tiene por qué empujar eventos al dashboard de prod.
// - En dev normal (sin mock) la lib de Vercel ya loguea a consola y no envía
//   hasta que se despliegue, así que dejamos pasar.
// - Centralizamos acá para poder grepear eventos y eventualmente cambiar de
//   proveedor sin tocar cada call site.

const isMock = import.meta.env.VITE_MOCK === 'true';

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function track(eventName: string, properties?: AnalyticsProps): void {
  if (isMock) return;
  try {
    vercelTrack(eventName, properties ?? undefined);
  } catch (e) {
    // No queremos que un fallo de tracking rompa la UI.
    console.warn('[analytics] track failed:', e);
  }
}
