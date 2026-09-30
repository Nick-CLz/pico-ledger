import type { Address, Loan, LoanId } from '@/core/domain/loan';
import type { LoanTerms } from '@/core/domain/policy';
import type { ClockPort, LoanBookPort } from '@/core/ports';

/**
 * In-memory ledger. Used for the zero-setup demo, for unit tests, and as the
 * reference behaviour the EVM adapter must match.
 */
export class InMemoryLoanBook implements LoanBookPort {
  private readonly loans = new Map<LoanId, Loan>();
  private nextId = 0;

  constructor(private readonly clock: ClockPort, seed: readonly Omit<Loan, 'id'>[] = []) {
    for (const loan of seed) this.insert(loan);
  }

  async listFor(account: Address): Promise<Loan[]> {
    const me = account.toLowerCase();
    return [...this.loans.values()].filter(
      (l) => l.lender.toLowerCase() === me || l.borrower.toLowerCase() === me,
    );
  }

  async get(id: LoanId): Promise<Loan | null> {
    return this.loans.get(id) ?? null;
  }

  async open(terms: LoanTerms): Promise<LoanId> {
    return this.insert({ ...terms, startedAt: this.clock.now(), repaid: 0n });
  }

  async repay(id: LoanId, _payer: Address, amount: bigint): Promise<void> {
    const loan = this.loans.get(id);
    if (!loan) throw new Error(`Unknown loan ${id}`);
    this.loans.set(id, { ...loan, repaid: loan.repaid + amount });
  }

  private insert(loan: Omit<Loan, 'id'>): LoanId {
    const id = String(this.nextId++);
    this.loans.set(id, { ...loan, id });
    return id;
  }
}
