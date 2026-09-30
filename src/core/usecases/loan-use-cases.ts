import type { Address, Loan, LoanId } from '../domain/loan';
import {
  DEFAULT_POLICY,
  err,
  ok,
  validateRepayment,
  validateTerms,
  type LendingPolicy,
  type PolicyViolation,
  type Result,
} from '../domain/policy';
import { summarise, type PortfolioSummary } from '../domain/portfolio';
import type { ClockPort, LoanBookPort, WalletPort } from '../ports';

/**
 * Application services (driving ports). The UI calls these and nothing else,
 * so swapping the in-memory ledger for the on-chain one is a one-line change
 * in the composition root.
 */

export type UseCaseError = PolicyViolation | { code: 'NOT_CONNECTED' } | { code: 'NOT_FOUND' };

export interface LoanUseCases {
  connect(): Promise<Address>;
  currentAccount(): Promise<Address | null>;
  loadPortfolio(): Promise<Result<{ account: Address; loans: Loan[]; summary: PortfolioSummary }, UseCaseError>>;
  openLoan(input: { borrower: Address; principal: bigint; feeBps: number; termDays: number }): Promise<Result<LoanId, UseCaseError>>;
  repayLoan(input: { id: LoanId; amount: bigint }): Promise<Result<void, UseCaseError>>;
  readonly policy: LendingPolicy;
}

export interface Deps {
  loanBook: LoanBookPort;
  wallet: WalletPort;
  clock: ClockPort;
  policy?: LendingPolicy;
}

export function createLoanUseCases({ loanBook, wallet, clock, policy = DEFAULT_POLICY }: Deps): LoanUseCases {
  return {
    policy,

    connect: () => wallet.connect(),
    currentAccount: () => wallet.current(),

    async loadPortfolio() {
      const account = await wallet.current();
      if (!account) return err({ code: 'NOT_CONNECTED' });
      const loans = await loanBook.listFor(account);
      loans.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      return ok({ account, loans, summary: summarise(loans, account, clock.now()) });
    },

    async openLoan(input) {
      const lender = await wallet.current();
      if (!lender) return err({ code: 'NOT_CONNECTED' });
      const checked = validateTerms({ lender, ...input }, policy);
      if (!checked.ok) return checked;
      return ok(await loanBook.open(checked.value));
    },

    async repayLoan({ id, amount }) {
      const payer = await wallet.current();
      if (!payer) return err({ code: 'NOT_CONNECTED' });
      const loan = await loanBook.get(id);
      if (!loan) return err({ code: 'NOT_FOUND' });
      const checked = validateRepayment(loan, payer, amount);
      if (!checked.ok) return checked;
      await loanBook.repay(id, payer, checked.value);
      return ok(undefined);
    },
  };
}
