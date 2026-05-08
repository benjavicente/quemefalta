/**
 * Flag emoji for album team codes (FIFA-style 3-letter codes).
 * Uses ISO 3166-1 alpha-2 regional indicators, with overrides for England and Scotland.
 */

/** Intro & FIFA Museum (code FWC) — not a country flag */
const SECTION_ICONS: Record<string, string> = {
  FWC: '⚽',
};

const SUBDIVISION_FLAGS: Record<string, string> = {
  ENG: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  SCO: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
};

/** FIFA / album code → ISO 3166-1 alpha-2 (for regional-indicator flags). */
const FIFA_TO_ISO2: Record<string, string> = {
  MEX: 'MX',
  ECU: 'EC',
  CUW: 'CW',
  HAI: 'HT',
  USA: 'US',
  COL: 'CO',
  NZL: 'NZ',
  PAN: 'PA',
  CAN: 'CA',
  MAR: 'MA',
  IRQ: 'IQ',
  CPV: 'CV',
  ARG: 'AR',
  CZE: 'CZ',
  RSA: 'ZA',
  PAR: 'PY',
  FRA: 'FR',
  AUT: 'AT',
  TUN: 'TN',
  UZB: 'UZ',
  BRA: 'BR',
  NOR: 'NO',
  CIV: 'CI',
  JOR: 'JO',
  URU: 'UY',
  IRN: 'IR',
  GHA: 'GH',
  ESP: 'ES',
  TUR: 'TR',
  COD: 'CD',
  BIH: 'BA',
  GER: 'DE',
  BEL: 'BE',
  ALG: 'DZ',
  EGY: 'EG',
  POR: 'PT',
  CRO: 'HR',
  SEN: 'SN',
  NED: 'NL',
  JPN: 'JP',
  KSA: 'SA',
  SWE: 'SE',
  KOR: 'KR',
  SUI: 'CH',
  QAT: 'QA',
  AUS: 'AU',
};

function iso2ToFlag(iso2: string): string {
  const u = iso2.toUpperCase();
  if (u.length !== 2) return '';
  const base = 0x1f1e6;
  const a = u.codePointAt(0);
  const b = u.codePointAt(1);
  if (a === undefined || b === undefined) return '';
  return String.fromCodePoint(base + a - 65, base + b - 65);
}

export function teamFlagEmoji(teamCode: string): string {
  const icon = SECTION_ICONS[teamCode];
  if (icon) return icon;
  const sub = SUBDIVISION_FLAGS[teamCode];
  if (sub) return sub;
  const iso2 = FIFA_TO_ISO2[teamCode];
  if (!iso2) return '';
  return iso2ToFlag(iso2);
}
