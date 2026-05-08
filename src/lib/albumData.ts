export interface AlbumSection {
  id: string;
  name: string;
  code: string;
  count: number;
  startsAt: number;
  group?: string;
  isTeam?: boolean;
}

interface TeamDef {
  name: string;
  code: string;
}

const GROUPS: Record<string, TeamDef[]> = {
  A: [
    { name: 'México', code: 'MEX' },
    { name: 'Ecuador', code: 'ECU' },
    { name: 'Curazao', code: 'CUW' },
    { name: 'Haití', code: 'HAI' },
  ],
  B: [
    { name: 'Estados Unidos', code: 'USA' },
    { name: 'Colombia', code: 'COL' },
    { name: 'Nueva Zelanda', code: 'NZL' },
    { name: 'Panamá', code: 'PAN' },
  ],
  C: [
    { name: 'Canadá', code: 'CAN' },
    { name: 'Marruecos', code: 'MAR' },
    { name: 'Irak', code: 'IRQ' },
    { name: 'Cabo Verde', code: 'CPV' },
  ],
  D: [
    { name: 'Argentina', code: 'ARG' },
    { name: 'Chequia', code: 'CZE' },
    { name: 'Sudáfrica', code: 'RSA' },
    { name: 'Paraguay', code: 'PAR' },
  ],
  E: [
    { name: 'Francia', code: 'FRA' },
    { name: 'Austria', code: 'AUT' },
    { name: 'Túnez', code: 'TUN' },
    { name: 'Uzbekistán', code: 'UZB' },
  ],
  F: [
    { name: 'Brasil', code: 'BRA' },
    { name: 'Noruega', code: 'NOR' },
    { name: 'Costa de Marfil', code: 'CIV' },
    { name: 'Jordania', code: 'JOR' },
  ],
  G: [
    { name: 'Inglaterra', code: 'ENG' },
    { name: 'Uruguay', code: 'URU' },
    { name: 'Irán', code: 'IRN' },
    { name: 'Ghana', code: 'GHA' },
  ],
  H: [
    { name: 'España', code: 'ESP' },
    { name: 'Turquía', code: 'TUR' },
    { name: 'Congo DR', code: 'COD' },
    { name: 'Bosnia y Herzegovina', code: 'BIH' },
  ],
  I: [
    { name: 'Alemania', code: 'GER' },
    { name: 'Bélgica', code: 'BEL' },
    { name: 'Argelia', code: 'ALG' },
    { name: 'Egipto', code: 'EGY' },
  ],
  J: [
    { name: 'Portugal', code: 'POR' },
    { name: 'Croacia', code: 'CRO' },
    { name: 'Senegal', code: 'SEN' },
    { name: 'Escocia', code: 'SCO' },
  ],
  K: [
    { name: 'Países Bajos', code: 'NED' },
    { name: 'Japón', code: 'JPN' },
    { name: 'Arabia Saudita', code: 'KSA' },
    { name: 'Suecia', code: 'SWE' },
  ],
  L: [
    { name: 'Corea del Sur', code: 'KOR' },
    { name: 'Suiza', code: 'SUI' },
    { name: 'Catar', code: 'QAT' },
    { name: 'Australia', code: 'AUS' },
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
  const indexInSection = stickerNumber - sec.startsAt + 1;
  return `${sec.code}${indexInSection}`;
}
