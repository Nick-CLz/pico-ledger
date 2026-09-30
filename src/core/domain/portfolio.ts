import { daysPastDue, outstanding, statusAt, type Address, type Loan } from './loan';

/** Delinquency buckets used in credit-risk reporting. */
export type DpdBucket = 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+';

export function bucketFor(dpd: number): DpdBucket {
  if (dpd <= 0) return 'CURRENT';
  if (dpd <= 30) return '1-30';
  if (dpd <= 60) return '31-60';
  if (dpd <= 90) return '61-90';
  return '90+';
}

export interface PortfolioSummary {
  readonly loanCount: number;
  readonly totalLent: bigint;
  readonly totalBorrowed: bigint;
  readonly outstandingReceivable: bigint;
  readonly outstandingPayable: bigint;
  /** Share of receivable balance that is overdue, in basis points. */
  readonly portfolioAtRiskBps: number;
  readonly buckets: Readonly<Record<DpdBucket, number>>;
}

const EMPTY_BUCKETS: Record<DpdBucket, number> = {
  CURRENT: 0,
  '1-30': 0,
  '31-60': 0,
  '61-90': 0,
  '90+': 0,
};

/**
 * Summarise an account's loans from both sides of the book.
 * Portfolio-at-risk (PAR) is the standard microfinance health metric:
 * overdue receivable balance / total receivable balance.
 */
export function summarise(loans: readonly Loan[], account: Address, now: Date): PortfolioSummary {
  const me = account.toLowerCase();
  let totalLent = 0n;
  let totalBorrowed = 0n;
  let receivable = 0n;
  let payable = 0n;
  let overdueReceivable = 0n;
  const buckets = { ...EMPTY_BUCKETS };

  for (const loan of loans) {
    const bal = outstanding(loan);
    if (loan.lender.toLowerCase() === me) {
      totalLent += loan.principal;
      receivable += bal;
      if (statusAt(loan, now) === 'OVERDUE') overdueReceivable += bal;
      if (bal > 0n) buckets[bucketFor(daysPastDue(loan, now))] += 1;
    }
    if (loan.borrower.toLowerCase() === me) {
      totalBorrowed += loan.principal;
      payable += bal;
    }
  }

  const portfolioAtRiskBps =
    receivable === 0n ? 0 : Number((overdueReceivable * 10_000n) / receivable);

  return {
    loanCount: loans.length,
    totalLent,
    totalBorrowed,
    outstandingReceivable: receivable,
    outstandingPayable: payable,
    portfolioAtRiskBps,
    buckets,
  };
}
