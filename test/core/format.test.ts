import { describe, expect, it } from 'vitest';
import { formatEth, parseEth } from '@/ui/format';

describe('ETH formatting', () => {
  it('round-trips without floating-point loss', () => {
    for (const s of ['0', '1', '0.1', '0.000000000000000001', '123.789', '1.020000000000000001']) {
      expect(formatEth(parseEth(s)!, 18)).toBe(s);
    }
  });

  it('trims trailing zeros and groups thousands', () => {
    expect(formatEth(1_500_000_000_000_000_000n)).toBe('1.5');
    expect(formatEth(1234n * 10n ** 18n)).toBe('1,234');
    expect(formatEth(10n ** 14n, 4)).toBe('0.0001');
    expect(formatEth(10n ** 13n, 4)).toBe('0');
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '.', '-1', '1e18', '1.2.3', '0x10', '1.0000000000000000001']) expect(parseEth(bad)).toBeNull();
  });
});
