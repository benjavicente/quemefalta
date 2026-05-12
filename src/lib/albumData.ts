export interface AlbumSection {
  id: string;
  name: string;
  code: string;
  count: number;
  startsAt: number;
  group?: string;
  isTeam?: boolean;
  zeroIndexed?: boolean;
}

interface TeamDef {
  name: string;
  code: string;
}

export const GROUPS: Record<string, TeamDef[]> = {
  A: [
    { name: 'México', code: 'MEX' },
    { name: 'Sudáfrica', code: 'RSA' },
    { name: 'Corea del Sur', code: 'KOR' },
    { name: 'Chequia', code: 'CZE' },
  ],
  B: [
    { name: 'Canadá', code: 'CAN' },
    { name: 'Bosnia y Herzegovina', code: 'BIH' },
    { name: 'Catar', code: 'QAT' },
    { name: 'Suiza', code: 'SUI' },
  ],
  C: [
    { name: 'Brasil', code: 'BRA' },
    { name: 'Marruecos', code: 'MAR' },
    { name: 'Haití', code: 'HAI' },
    { name: 'Escocia', code: 'SCO' },
  ],
  D: [
    { name: 'Estados Unidos', code: 'USA' },
    { name: 'Paraguay', code: 'PAR' },
    { name: 'Australia', code: 'AUS' },
    { name: 'Turquía', code: 'TUR' },
  ],
  E: [
    { name: 'Alemania', code: 'GER' },
    { name: 'Curazao', code: 'CUW' },
    { name: 'Costa de Marfil', code: 'CIV' },
    { name: 'Ecuador', code: 'ECU' },
  ],
  F: [
    { name: 'Países Bajos', code: 'NED' },
    { name: 'Japón', code: 'JPN' },
    { name: 'Suecia', code: 'SWE' },
    { name: 'Túnez', code: 'TUN' },
  ],
  G: [
    { name: 'Bélgica', code: 'BEL' },
    { name: 'Egipto', code: 'EGY' },
    { name: 'Irán', code: 'IRN' },
    { name: 'Nueva Zelanda', code: 'NZL' },
  ],
  H: [
    { name: 'España', code: 'ESP' },
    { name: 'Cabo Verde', code: 'CPV' },
    { name: 'Arabia Saudita', code: 'KSA' },
    { name: 'Uruguay', code: 'URU' },
  ],
  I: [
    { name: 'Francia', code: 'FRA' },
    { name: 'Senegal', code: 'SEN' },
    { name: 'Irak', code: 'IRQ' },
    { name: 'Noruega', code: 'NOR' },
  ],
  J: [
    { name: 'Argentina', code: 'ARG' },
    { name: 'Argelia', code: 'ALG' },
    { name: 'Austria', code: 'AUT' },
    { name: 'Jordania', code: 'JOR' },
  ],
  K: [
    { name: 'Portugal', code: 'POR' },
    { name: 'RD Congo', code: 'COD' },
    { name: 'Uzbekistán', code: 'UZB' },
    { name: 'Colombia', code: 'COL' },
  ],
  L: [
    { name: 'Inglaterra', code: 'ENG' },
    { name: 'Croacia', code: 'CRO' },
    { name: 'Ghana', code: 'GHA' },
    { name: 'Panamá', code: 'PAN' },
  ],
};

// Build team sections: 48 teams × 20 stickers, starting at 21
const teamSections: AlbumSection[] = [];
let teamStart = 21;
for (const [group, teams] of Object.entries(GROUPS)) {
  for (const team of teams) {
    teamSections.push({
      id: `team-${team.code.toLowerCase()}`,
      name: team.name,
      code: team.code,
      count: 20,
      startsAt: teamStart,
      group,
      isTeam: true,
    });
    teamStart += 20;
  }
}

export const ALBUM_SECTIONS: AlbumSection[] = [
  {
    id: 'intro',
    name: 'Introducción & FIFA Museum',
    code: 'FWC',
    count: 20,
    startsAt: 1,
    zeroIndexed: true,
  },
  ...teamSections,
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
  const indexInSection = sec.zeroIndexed
    ? stickerNumber - sec.startsAt
    : stickerNumber - sec.startsAt + 1;
  return `${sec.code}${indexInSection}`;
}

/**
 * Inverse of codeForSticker: "MEX5" → 25, "FWC0" → 1
 * Returns undefined if code is invalid.
 */
export function stickerNumberFromCode(code: string): number | undefined {
  const match = code.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return undefined;
  const [, prefix, numStr] = match;
  const idx = parseInt(numStr);
  const sec = ALBUM_SECTIONS.find((s) => s.code === prefix);
  if (!sec) return undefined;
  if (sec.zeroIndexed) {
    if (idx < 0 || idx >= sec.count) return undefined;
    return sec.startsAt + idx;
  }
  if (idx < 1 || idx > sec.count) return undefined;
  return sec.startsAt + idx - 1;
}
