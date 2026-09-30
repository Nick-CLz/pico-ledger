const WEI = 10n ** 18n;

/** Format wei as ETH with up to `dp` decimals, trimming trailing zeros. */
export function formatEth(wei: bigint, dp = 4): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / WEI;
  const frac = (abs % WEI).toString().padStart(18, '0').slice(0, dp).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toLocaleString('en-US')}${frac ? `.${frac}` : ''}`;
}

/** Parse a user-typed ETH amount into wei. Returns null for invalid input. */
export function parseEth(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return BigInt(whole) * WEI + BigInt(frac.padEnd(18, '0'));
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;
