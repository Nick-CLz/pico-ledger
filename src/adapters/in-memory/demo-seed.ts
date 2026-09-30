import type { Address, Loan } from '@/core/domain/loan';

const DAY = 86_400_000;
const ETH = 10n ** 18n;

export const DEMO_ACCOUNT: Address = '0x5a1e5000000000000000000000000000000000a1';

const borrowers: Address[] = [
  '0xb0770000000000000000000000000000000000b1',
  '0xb0770000000000000000000000000000000000b2',
  '0xb0770000000000000000000000000000000000b3',
  '0xb0770000000000000000000000000000000000b4',
];
const otherLender: Address = '0x1e4d000000000000000000000000000000000c01';

export const DEMO_IDENTITIES: { label: string; address: Address }[] = [
  { label: 'Lender (you)', address: DEMO_ACCOUNT },
  { label: 'Borrower B1', address: borrowers[0] },
  { label: 'Borrower B2', address: borrowers[1] },
];

/** A small, realistic-looking book so the demo shows every status and DPD bucket. */
export function demoSeed(now: Date): Omit<Loan, 'id'>[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY);
  return [
    { lender: DEMO_ACCOUNT, borrower: borrowers[0], principal: ETH / 2n, feeBps: 150, termDays: 30, startedAt: ago(10), repaid: 0n },
    { lender: DEMO_ACCOUNT, borrower: borrowers[1], principal: ETH / 4n, feeBps: 250, termDays: 60, startedAt: ago(75), repaid: ETH / 10n },
    { lender: DEMO_ACCOUNT, borrower: borrowers[2], principal: ETH / 5n, feeBps: 100, termDays: 30, startedAt: ago(40), repaid: (ETH / 5n) * 101n / 100n },
    { lender: DEMO_ACCOUNT, borrower: borrowers[3], principal: ETH / 10n, feeBps: 80, termDays: 14, startedAt: ago(120), repaid: 0n },
    { lender: otherLender, borrower: DEMO_ACCOUNT, principal: ETH / 8n, feeBps: 120, termDays: 30, startedAt: ago(5), repaid: 0n },
  ];
}
