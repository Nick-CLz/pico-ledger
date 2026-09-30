import type { ClockPort } from '@/core/ports';

export const systemClock: ClockPort = { now: () => new Date() };

export function fixedClock(at: Date): ClockPort & { advanceDays(n: number): void } {
  let t = at.getTime();
  return {
    now: () => new Date(t),
    advanceDays(n) {
      t += n * 86_400_000;
    },
  };
}
