export interface AlbumSection {
  id: string;
  name: string;
  code: string;
  count: number;
  startsAt: number;
  isTeam?: boolean;
}

const TEAM_NAMES = [
  'Canadá',
  'México',
  'EE.UU.',
  'Argentina',
  'Brasil',
  'Uruguay',
  'Colombia',
  'Ecuador',
  'Paraguay',
  'Chile',
  'Perú',
  'Bolivia',
  'Francia',
  'Inglaterra',
  'España',
  'Alemania',
  'Portugal',
  'Italia',
  'Países Bajos',
  'Bélgica',
  'Croacia',
  'Suiza',
  'Dinamarca',
  'Polonia',
  'Austria',
  'Serbia',
  'Ucrania',
  'Turquía',
  'Marruecos',
  'Senegal',
  'Egipto',
  'Nigeria',
  'Túnez',
  'Argelia',
  'Camerún',
  'Ghana',
  'Japón',
  'Corea del Sur',
  'Australia',
  'Irán',
  'Arabia Saudita',
  'Catar',
  'Nueva Zelanda',
  'Costa Rica',
  'Panamá',
  'Honduras',
  'Jamaica',
  'Cabo Verde',
];

function teamCode(name: string): string {
  return name
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, 'X');
}

export const ALBUM_SECTIONS: AlbumSection[] = [
  { id: 'intro', name: 'Introducción & Mascotas', code: 'INT', count: 18, startsAt: 1 },
  { id: 'stadiums', name: 'Estadios & Sedes', code: 'STA', count: 32, startsAt: 19 },
  { id: 'legends', name: 'Leyendas del Mundial', code: 'LEG', count: 20, startsAt: 51 },
  ...TEAM_NAMES.map((name, i) => ({
    id: `team-${i}`,
    name,
    code: teamCode(name),
    count: 16,
    startsAt: 71 + i * 16,
    isTeam: true,
  })),
  { id: 'fwc-trophy', name: 'FIFA World Cup Trophy', code: 'FWC', count: 12, startsAt: 839 },
  { id: 'specials', name: 'Especiales & Brillantes', code: 'SPE', count: 50, startsAt: 851 },
  { id: 'icons', name: 'Íconos del Torneo', code: 'ICO', count: 73, startsAt: 901 },
];

export const TOTAL_STICKERS = ALBUM_SECTIONS.reduce((sum, s) => sum + s.count, 0);

// Helpers para mapear número → sección
export function sectionForSticker(stickerNumber: number): AlbumSection | undefined {
  return ALBUM_SECTIONS.find(
    (s) => stickerNumber >= s.startsAt && stickerNumber < s.startsAt + s.count,
  );
}

export function codeForSticker(stickerNumber: number): string {
  const sec = sectionForSticker(stickerNumber);
  if (!sec) return `?${stickerNumber}`;
  const indexInSection = stickerNumber - sec.startsAt + 1;
  return `${sec.code}${indexInSection}`;
}
