/** FWC section layout & image configuration */

export const FWC_CODE = 'FWC';

export const FWC_HORIZONTAL_IMG =
  'https://img.freepik.com/vector-premium/estadio-futbol-pelota_302982-625.jpg';

export const FWC_VERTICAL_IMG =
  'https://thumbs.dreamstime.com/b/copa-de-f%C3%BAtbol-dibujos-animados-sobre-el-fondo-del-estadio-con-confetti-atril-victoria-dorada-en-primer-plano-campeonato-confeti-277869230.jpg';

/** 1-based indices within FWC that are vertical (portrait) */
export const FWC_VERTICAL_RANGE: [number, number] = [4, 8];

export function getFwcVariant(indexInSection: number): 'fwc-h' | 'fwc-v' {
  return indexInSection >= FWC_VERTICAL_RANGE[0] && indexInSection <= FWC_VERTICAL_RANGE[1]
    ? 'fwc-v'
    : 'fwc-h';
}
