import { annualisedRateBps, outstanding, type Address, type Loan } from './loan';

/**
 * Lending policy: the business rules a loan must satisfy before we ever
 * ask a wallet to sign. The same caps are enforced on-chain in
 * contracts/PicoLoanBook.sol — validating here first gives users instant,
 * human-readable feedback instead of a reverted transaction and wasted gas.
 */
export interface LendingPolicy {
  /** Maximum annualised rate, in basis points (3_600 = 36% p.a.). */
  readonly maxAprBps: number;
  readonly minTermDays: number;
  readonly maxTermDays: number;
  readonly minPrincipal: bigint;
}

export const DEFAULT_POLICY: LendingPolicy = {
  maxAprBps: 3_600,
  minTermDays: 7,
  maxTermDays: 365,
  minPrincipal: 1_000_000_000_000_000n, // 0.001 ETH
};

export type PolicyViolation =
  | { code: 'SELF_LOAN' }
  | { code: 'PRINCIPAL_TOO_SMALL'; min: bigint }
  | { code: 'TERM_OUT_OF_RANGE'; min: number; max: number }
  | { code: 'FEE_NEGATIVE' }
  | { code: 'APR_ABOVE_CAP'; aprBps: number; capBps: number }
  | { code: 'NOT_BORROWER' }
  | { code: 'NOTHING_OUTSTANDING' }
  | { code: 'AMOUNT_NOT_POSITIVE' }
  | { code: 'OVERPAYMENT'; outstanding: bigint };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface LoanTerms {
  readonly lender: Address;
  readonly borrower: Address;
  readonly principal: bigint;
  readonly feeBps: number;
  readonly termDays: number;
}

export function validateTerms(
  terms: LoanTerms,
  policy: LendingPolicy = DEFAULT_POLICY,
): Result<LoanTerms, PolicyViolation> {
  if (terms.lender.toLowerCase() === terms.borrower.toLowerCase()) {
    return err({ code: 'SELF_LOAN' });
  }
  if (terms.principal < policy.minPrincipal) {
    return err({ code: 'PRINCIPAL_TOO_SMALL', min: policy.minPrincipal });
  }
  if (
    !Number.isInteger(terms.termDays) ||
    terms.termDays < policy.minTermDays ||
    terms.termDays > policy.maxTermDays
  ) {
    return err({ code: 'TERM_OUT_OF_RANGE', min: policy.minTermDays, max: policy.maxTermDays });
  }
  if (!Number.isInteger(terms.feeBps) || terms.feeBps < 0) {
    return err({ code: 'FEE_NEGATIVE' });
  }
  const aprBps = annualisedRateBps(terms.feeBps, terms.termDays);
  if (aprBps > policy.maxAprBps) {
    return err({ code: 'APR_ABOVE_CAP', aprBps, capBps: policy.maxAprBps });
  }
  return ok(terms);
}

export function validateRepayment(
  loan: Loan,
  payer: Address,
  amount: bigint,
): Result<bigint, PolicyViolation> {
  if (payer.toLowerCase() !== loan.borrower.toLowerCase()) return err({ code: 'NOT_BORROWER' });
  if (amount <= 0n) return err({ code: 'AMOUNT_NOT_POSITIVE' });
  const due = outstanding(loan);
  if (due === 0n) return err({ code: 'NOTHING_OUTSTANDING' });
  if (amount > due) return err({ code: 'OVERPAYMENT', outstanding: due });
  return ok(amount);
}

/** Human-readable messages for the UI layer. Kept here so wording is testable. */
export function describeViolation(v: PolicyViolation): string {
  switch (v.code) {
    case 'SELF_LOAN':
      return 'Lender and borrower must be different accounts.';
    case 'PRINCIPAL_TOO_SMALL':
      return 'Principal is below the minimum loan size.';
    case 'TERM_OUT_OF_RANGE':
      return `Term must be a whole number of days between ${v.min} and ${v.max}.`;
    case 'FEE_NEGATIVE':
      return 'Fee must be a non-negative whole number of basis points.';
    case 'APR_ABOVE_CAP':
      return `Implied APR ${(v.aprBps / 100).toFixed(2)}% exceeds the ${(v.capBps / 100).toFixed(2)}% cap.`;
    case 'NOT_BORROWER':
      return 'Only the borrower can repay this loan.';
    case 'NOTHING_OUTSTANDING':
      return 'This loan is already fully repaid.';
    case 'AMOUNT_NOT_POSITIVE':
      return 'Repayment amount must be greater than zero.';
    case 'OVERPAYMENT':
      return 'Repayment exceeds the outstanding balance.';
  }
}
