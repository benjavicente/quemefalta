import { describe, it, expect } from 'vitest';
import { teamFlagEmoji } from '@/lib/teamFlagEmoji';

describe('teamFlagEmoji', () => {
  it('uses ball emoji for intro section code FWC', () => {
    expect(teamFlagEmoji('FWC')).toBe('⚽');
  });

  it('maps FIFA codes to regional-indicator flags', () => {
    expect(teamFlagEmoji('MEX')).toBe('🇲🇽');
    expect(teamFlagEmoji('ARG')).toBe('🇦🇷');
    expect(teamFlagEmoji('NED')).toBe('🇳🇱');
    expect(teamFlagEmoji('GER')).toBe('🇩🇪');
    expect(teamFlagEmoji('CUW')).toBe('🇨🇼');
  });

  it('uses subdivision flags for England and Scotland', () => {
    expect(teamFlagEmoji('ENG').length).toBeGreaterThan(1);
    expect(teamFlagEmoji('SCO').length).toBeGreaterThan(1);
    expect(teamFlagEmoji('ENG').codePointAt(0)).toBe(0x1f3f4);
    expect(teamFlagEmoji('SCO').codePointAt(0)).toBe(0x1f3f4);
  });
});
