import { describe, expect, it } from 'vitest';
import { annualisedRateBps, outstanding, statusAt, totalDue, type Address, type Loan } from '@/core/domain/loan';
import { DEFAULT_POLICY, validateRepayment, validateTerms } from '@/core/domain/policy';

const A = '0x00000000000000000000000000000000000000a1' as Address;
const B = '0x00000000000000000000000000000000000000b1' as Address;
const ETH = 10n ** 18n;

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: '0', lender: A, borrower: B, principal: ETH, feeBps: 200, termDays: 30,
  startedAt: new Date('2026-01-01T00:00:00Z'), repaid: 0n, ...over,
});

describe('loan maths', () => {
  it('computes total due as principal plus flat fee', () => {
    expect(totalDue(loan())).toBe(ETH + ETH / 50n);
  });

  it('annualises a flat fee and rounds up', () => {
    expect(annualisedRateBps(300, 30)).toBe(3650);
    expect(annualisedRateBps(1, 365)).toBe(1);
    expect(annualisedRateBps(1, 366)).toBe(1); // ceil, never rounds a positive fee to 0
  });

  it('moves ACTIVE -> OVERDUE -> REPAID', () => {
    const l = loan();
    expect(statusAt(l, new Date('2026-01-15'))).toBe('ACTIVE');
    expect(statusAt(l, new Date('2026-03-01'))).toBe('OVERDUE');
    expect(statusAt({ ...l, repaid: totalDue(l) }, new Date('2026-03-01'))).toBe('REPAID');
    expect(outstanding({ ...l, repaid: totalDue(l) + 1n })).toBe(0n);
  });
});

describe('validateTerms', () => {
  const base = { lender: A, borrower: B, principal: ETH, feeBps: 200, termDays: 30 };

  it('accepts terms within policy', () => {
    expect(validateTerms(base).ok).toBe(true);
  });

  it.each([
    [{ borrower: A }, 'SELF_LOAN'],
    [{ principal: 1n }, 'PRINCIPAL_TOO_SMALL'],
    [{ termDays: 3 }, 'TERM_OUT_OF_RANGE'],
    [{ termDays: 30.5 }, 'TERM_OUT_OF_RANGE'],
    [{ feeBps: -1 }, 'FEE_NEGATIVE'],
    [{ feeBps: 300, termDays: 30 }, 'APR_ABOVE_CAP'], // 36.5% > 36%
  ] as const)('rejects %o with %s', (over, code) => {
    const r = validateTerms({ ...base, ...over });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });

  it('treats the cap as inclusive', () => {
    // 3600 bps over 365 days is exactly 36%.
    expect(validateTerms({ ...base, feeBps: 3600, termDays: 365 }, DEFAULT_POLICY).ok).toBe(true);
  });
});

describe('validateRepayment', () => {
  it('only lets the borrower repay, up to the outstanding balance', () => {
    const l = loan();
    expect(validateRepayment(l, A, 1n)).toMatchObject({ ok: false, error: { code: 'NOT_BORROWER' } });
    expect(validateRepayment(l, B, 0n)).toMatchObject({ ok: false, error: { code: 'AMOUNT_NOT_POSITIVE' } });
    expect(validateRepayment(l, B, totalDue(l) + 1n)).toMatchObject({ ok: false, error: { code: 'OVERPAYMENT' } });
    expect(validateRepayment(l, B, totalDue(l))).toEqual({ ok: true, value: totalDue(l) });
    expect(validateRepayment({ ...l, repaid: totalDue(l) }, B, 1n)).toMatchObject({ ok: false, error: { code: 'NOTHING_OUTSTANDING' } });
  });
});
