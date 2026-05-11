import { ALBUM_SECTIONS, TOTAL_STICKERS } from '@/lib/albumData';
import type { StickerState } from '@/composables/useStickers';

export class CsvParseError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.name = 'CsvParseError';
    this.line = line;
  }
}

/**
 * Generate a 49×20 CSV grid from the stickers map.
 * Each cell: 0=missing, 1=owned, 2+=owned+dupes.
 */
export function generateCsv(stickers: Record<number, StickerState>): string {
  const header = ['section', ...Array.from({ length: 20 }, (_, i) => String(i + 1))].join(',');

  const rows = ALBUM_SECTIONS.map((sec) => {
    const values = Array.from({ length: sec.count }, (_, i) => {
      const s = stickers[sec.startsAt + i];
      if (!s?.owned) return 0;
      return 1 + s.dupes;
    });
    return `${sec.code},${values.join(',')}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Parse a 49×20 CSV grid back into a sticker-number → quantity map.
 * quantity: 0=missing, 1=owned, 2+=owned+dupes.
 */
export function parseCsv(raw: string): { data: Map<number, number>; warnings: string[] } {
  // Strip BOM
  const clean = raw.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lines.length === 0) {
    throw new CsvParseError('El archivo está vacío');
  }

  // Build section lookup
  const sectionMap = new Map<string, (typeof ALBUM_SECTIONS)[0]>();
  for (const sec of ALBUM_SECTIONS) {
    sectionMap.set(sec.code.toUpperCase(), sec);
  }

  const data = new Map<number, number>();
  const warnings: string[] = [];
  let dataStart = 0;

  // Detect header row
  const firstCell = lines[0].split(',')[0].trim().toLowerCase();
  if (firstCell === 'section' || !sectionMap.has(firstCell.toUpperCase())) {
    dataStart = 1;
  }

  if (lines.length - dataStart === 0) {
    throw new CsvParseError('No se encontraron filas de datos');
  }

  for (let i = dataStart; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = lines[i].split(',').map((c) => c.trim());

    if (cells.length < 2) {
      warnings.push(`Fila ${lineNum}: vacía o mal formateada (omitida)`);
      continue;
    }

    const code = cells[0].toUpperCase();
    const sec = sectionMap.get(code);
    if (!sec) {
      warnings.push(`Fila ${lineNum}: sección "${cells[0]}" desconocida (omitida)`);
      continue;
    }

    const expectedCols = sec.count + 1;
    if (cells.length < expectedCols) {
      warnings.push(
        `Fila ${lineNum} (${code}): esperaba ${expectedCols} columnas, tiene ${cells.length} (omitida)`,
      );
      continue;
    }

    for (let j = 0; j < sec.count; j++) {
      const val = parseInt(cells[j + 1]);
      if (isNaN(val)) {
        warnings.push(
          `Fila ${lineNum} (${code}), col ${j + 1}: "${cells[j + 1]}" no es número (usando 0)`,
        );
        continue;
      }
      const qty = Math.max(0, val);
      const stickerNum = sec.startsAt + j;
      if (stickerNum >= 1 && stickerNum <= TOTAL_STICKERS) {
        data.set(stickerNum, qty);
      }
    }
  }

  if (data.size === 0 && warnings.length > 0) {
    throw new CsvParseError('No se pudieron extraer datos válidos del CSV');
  }

  return { data, warnings };
}
