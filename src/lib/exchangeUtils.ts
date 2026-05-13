import { ALBUM_SECTIONS, codeForSticker, type AlbumSection } from './albumData';

export interface StickerEntry {
  owned: boolean;
  dupes: number;
}

export type StickerMap = Map<number, StickerEntry>;

export interface ExchangeItem {
  stickerNumber: number;
  code: string;
  dupeCount: number;
}

export interface ExchangeGroup {
  section: AlbumSection;
  items: ExchangeItem[];
}

export interface ExchangeResult {
  aGivesB: ExchangeGroup[];
  bGivesA: ExchangeGroup[];
  aGivesBCount: number;
  bGivesACount: number;
}

/**
 * Computes what stickers two users can exchange.
 * aGivesB = A's duplicates that B is missing.
 * bGivesA = B's duplicates that A is missing.
 */
export function computeExchange(mapA: StickerMap, mapB: StickerMap): ExchangeResult {
  const aGivesB: ExchangeGroup[] = [];
  const bGivesA: ExchangeGroup[] = [];
  let aGivesBCount = 0;
  let bGivesACount = 0;

  for (const sec of ALBUM_SECTIONS) {
    const aItems: ExchangeItem[] = [];
    const bItems: ExchangeItem[] = [];

    for (let i = 0; i < sec.count; i++) {
      const num = sec.startsAt + i;
      const a = mapA.get(num);
      const b = mapB.get(num);

      // A has dupes and B doesn't own it
      if (a && a.dupes > 0 && (!b || !b.owned)) {
        aItems.push({ stickerNumber: num, code: codeForSticker(num), dupeCount: a.dupes });
      }

      // B has dupes and A doesn't own it
      if (b && b.dupes > 0 && (!a || !a.owned)) {
        bItems.push({ stickerNumber: num, code: codeForSticker(num), dupeCount: b.dupes });
      }
    }

    if (aItems.length > 0) {
      aGivesB.push({ section: sec, items: aItems });
      aGivesBCount += aItems.length;
    }
    if (bItems.length > 0) {
      bGivesA.push({ section: sec, items: bItems });
      bGivesACount += bItems.length;
    }
  }

  return { aGivesB, bGivesA, aGivesBCount, bGivesACount };
}

/** Format an exchange list for clipboard copy. */
export function formatExchangeList(
  giverName: string,
  receiverName: string,
  groups: ExchangeGroup[],
  totalCount: number,
): string {
  const lines = [`${giverName} le puede dar ${totalCount} láminas a ${receiverName}:`];
  for (const g of groups) {
    const codes = g.items.map((i) => (i.dupeCount > 1 ? `${i.code} (×${i.dupeCount})` : i.code));
    lines.push(`${g.section.name}: ${codes.join(', ')}`);
  }
  return lines.join('\n');
}
