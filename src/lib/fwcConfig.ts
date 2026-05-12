/** FWC section layout & image configuration */

import fwcHorizontalImg from '@/assets/fwc-horizontal.jpg';
import fwcVerticalImg from '@/assets/fwc-vertical.jpg';
import fwcOverride3Img from '@/assets/fwc-override-3.jpg';

export const FWC_CODE = 'FWC';

export const FWC_HORIZONTAL_IMG = fwcHorizontalImg;

/** Per-sticker image overrides (0-based index → URL) */
export const FWC_IMG_OVERRIDES: Record<number, string> = {
  3: fwcOverride3Img,
};

export const FWC_VERTICAL_IMG = fwcVerticalImg;

/** 0-based indices within FWC that are vertical (portrait) */
export const FWC_VERTICAL_RANGE: [number, number] = [4, 8];

export function getFwcVariant(indexInSection: number): 'fwc-h' | 'fwc-v' {
  return indexInSection >= FWC_VERTICAL_RANGE[0] && indexInSection <= FWC_VERTICAL_RANGE[1]
    ? 'fwc-v'
    : 'fwc-h';
}
