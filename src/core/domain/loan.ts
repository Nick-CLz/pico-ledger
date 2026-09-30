/**
 * Loan domain model.
 *
 * Pure TypeScript: no React, no viem, no browser APIs. Everything in
 * `src/core` must stay framework-free so it can be tested in isolation and
 * reused behind any adapter (in-memory, EVM, REST, ...).
 *
 * Amounts are integers in the smallest unit of the settlement asset
 * (wei for ETH). Using bigint avoids floating-point drift in money maths.
 */

export type Address = `0x${string}`;
export type LoanId = string;

export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'REPAID';

export interface Loan {
  readonly id: LoanId;
  readonly lender: Address;
  readonly borrower: Address;
  /** Principal disbursed to the borrower. */
  readonly principal: bigint;
  /** Flat fee charged over the full term, in basis points of principal. */
  readonly feeBps: number;
  readonly termDays: number;
  readonly startedAt: Date;
  /** Cumulative amount repaid so far. */
  readonly repaid: bigint;
}

export const BPS_DENOMINATOR = 10_000n;
const DAY_MS = 86_400_000;

export function feeAmount(loan: Pick<Loan, 'principal' | 'feeBps'>): bigint {
  return (loan.principal * BigInt(loan.feeBps)) / BPS_DENOMINATOR;
}

export function totalDue(loan: Pick<Loan, 'principal' | 'feeBps'>): bigint {
  return loan.principal + feeAmount(loan);
}

export function outstanding(loan: Loan): bigint {
  const remaining = totalDue(loan) - loan.repaid;
  return remaining > 0n ? remaining : 0n;
}

export function dueDate(loan: Pick<Loan, 'startedAt' | 'termDays'>): Date {
  return new Date(loan.startedAt.getTime() + loan.termDays * DAY_MS);
}

export function statusAt(loan: Loan, now: Date): LoanStatus {
  if (outstanding(loan) === 0n) return 'REPAID';
  return now.getTime() > dueDate(loan).getTime() ? 'OVERDUE' : 'ACTIVE';
}

/** Days past due (0 when not overdue). Used for risk bucketing. */
export function daysPastDue(loan: Loan, now: Date): number {
  if (statusAt(loan, now) !== 'OVERDUE') return 0;
  return Math.floor((now.getTime() - dueDate(loan).getTime()) / DAY_MS);
}

/**
 * Annualised rate implied by a flat fee over the term, in basis points.
 * feeBps * 365 / termDays, rounded up so the cap check is conservative.
 */
export function annualisedRateBps(feeBps: number, termDays: number): number {
  return Math.ceil((feeBps * 365) / termDays);
}
