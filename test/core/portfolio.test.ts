import { describe, expect, it } from 'vitest';
import { bucketFor, summarise } from '@/core/domain/portfolio';
import type { Address, Loan } from '@/core/domain/loan';

const ME = '0x00000000000000000000000000000000000000a1' as Address;
const X = '0x00000000000000000000000000000000000000b1' as Address;
const DAY = 86_400_000;
const now = new Date('2026-06-01T00:00:00Z');
const mk = (o: Partial<Loan>): Loan => ({
  id: '0', lender: ME, borrower: X, principal: 1000n, feeBps: 0, termDays: 30,
  startedAt: new Date(now.getTime() - 10 * DAY), repaid: 0n, ...o,
});

describe('portfolio summary', () => {
  it('buckets days past due', () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(bucketFor)).toEqual(
      ['CURRENT', '1-30', '1-30', '31-60', '31-60', '61-90', '61-90', '90+'],
    );
  });

  it('computes portfolio-at-risk on the receivable side only', () => {
    const loans = [
      mk({ id: '1' }), // current, 1000 outstanding
      mk({ id: '2', startedAt: new Date(now.getTime() - 45 * DAY) }), // 15 dpd, 1000 overdue
      mk({ id: '3', repaid: 1000n }), // repaid — excluded
      mk({ id: '4', lender: X, borrower: ME, startedAt: new Date(now.getTime() - 90 * DAY) }), // payable, overdue — excluded from PAR
    ];
    const s = summarise(loans, ME, now);
    expect(s.outstandingReceivable).toBe(2000n);
    expect(s.outstandingPayable).toBe(1000n);
    expect(s.portfolioAtRiskBps).toBe(5000);
    expect(s.buckets).toMatchObject({ CURRENT: 1, '1-30': 1 });
  });

  it('matches accounts case-insensitively', () => {
    const s = summarise([mk({ lender: ME.toUpperCase().replace('0X', '0x') as Address })], ME, now);
    expect(s.totalLent).toBe(1000n);
  });
});
