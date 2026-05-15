import type { AlbumSection } from './albumData';

/** lowercase + sin acentos para comparar sin importar tildes/case. */
export function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * True si la sección matchea el query libre. Soporta búsqueda por nombre
 * ("México", "introducción") o por código FIFA ("MEX", "FWC"). Query vacío
 * o whitespace-only retorna true (no-op filter).
 */
export function matchesSection(section: AlbumSection, query: string): boolean {
  const q = normalizeStr(query.trim());
  if (!q) return true;
  return normalizeStr(section.name).includes(q) || normalizeStr(section.code).includes(q);
}
