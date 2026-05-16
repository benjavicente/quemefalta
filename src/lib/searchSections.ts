import type { AlbumSection } from './albumData';

/** lowercase + sin acentos para comparar sin importar tildes/case. */
export function normalizeStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * True si la sección matchea el query libre. Soporta:
 * - Nombre ("México", "argentina", "introducción")
 * - Código FIFA ("MEX", "ARG", "FWC")
 * - Código de sticker ("arg7" → sección ARG, "mex1" → sección MEX)
 * - Solo número ("7", "17") → matchea todas las secciones (el filtro fino
 *   se aplica a nivel sticker)
 *
 * Query vacío o whitespace-only retorna true (no-op filter).
 */
export function matchesSection(section: AlbumSection, query: string): boolean {
  const q = normalizeStr(query.trim());
  if (!q) return true;
  if (normalizeStr(section.name).includes(q)) return true;
  if (normalizeStr(section.code).includes(q)) return true;
  if (/\d/.test(q)) {
    const alphaPart = q.replace(/\d+/g, '');
    // "arg7" → la parte alfa coincide con el código FIFA
    if (alphaPart && alphaPart === normalizeStr(section.code)) return true;
    // "7" solo → todas las secciones pasan; el filtro real es a nivel sticker
    if (!alphaPart) return true;
  }
  return false;
}

/**
 * True si el código del sticker matchea el query como prefijo (ILIKE).
 * - "arg7" → solo ARG7
 * - "arg1" → ARG1, ARG10, ARG11, …, ARG19
 * - "7"    → ARG7, MEX7, BRA7, … (matchea el prefijo numérico del código)
 * - "1"    → todos los #1 y los #10–19 de cada sección
 * - "arg"  → todos los stickers de ARG (pass-through cuando no hay dígitos)
 * - ""     → todos (pass-through)
 *
 * Si el query no contiene dígitos, no filtramos a nivel sticker: la lógica
 * de sección ya hace su trabajo y los items se muestran todos.
 */
export function matchesStickerCode(stickerCode: string, query: string): boolean {
  const q = normalizeStr(query.trim());
  if (!q) return true;
  if (!/\d/.test(q)) return true;
  const code = normalizeStr(stickerCode);
  const alphaPart = q.replace(/\d+/g, '');
  // Query con letras (ej. "arg7") → prefijo sobre el código completo
  if (alphaPart) return code.startsWith(q);
  // Query solo numérico (ej. "7", "17") → prefijo sobre la parte numérica
  const numMatch = code.match(/(\d+)$/);
  if (!numMatch) return false;
  return numMatch[1].startsWith(q);
}
