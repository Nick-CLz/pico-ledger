import type { Address, Loan, LoanId } from '../domain/loan';
import type { LoanTerms } from '../domain/policy';

/**
 * Driven ports: what the core needs from the outside world.
 * Adapters in `src/adapters/*` implement these; the core never imports them.
 */

/** Persistence + settlement of loans (in-memory, EVM contract, REST API...). */
export interface LoanBookPort {
  listFor(account: Address): Promise<Loan[]>;
  get(id: LoanId): Promise<Loan | null>;
  /** Disburse a new loan. Resolves once the ledger has recorded it. */
  open(terms: LoanTerms): Promise<LoanId>;
  repay(id: LoanId, payer: Address, amount: bigint): Promise<void>;
}

/** The signing identity of the current user. */
export interface WalletPort {
  readonly kind: 'injected' | 'demo';
  current(): Promise<Address | null>;
  connect(): Promise<Address>;
}

export interface ClockPort {
  now(): Date;
}
