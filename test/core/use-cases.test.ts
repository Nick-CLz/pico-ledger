import { beforeEach, describe, expect, it } from 'vitest';
import { createLoanUseCases, type LoanUseCases } from '@/core/usecases/loan-use-cases';
import { InMemoryLoanBook } from '@/adapters/in-memory/in-memory-loan-book';
import { DemoWallet } from '@/adapters/wallet/wallets';
import { fixedClock } from '@/adapters/clock/clocks';
import { totalDue, type Address } from '@/core/domain/loan';

const LENDER = '0x00000000000000000000000000000000000000a1' as Address;
const BORROWER = '0x00000000000000000000000000000000000000b1' as Address;
const ETH = 10n ** 18n;

describe('loan use cases (in-memory adapters)', () => {
  let clock: ReturnType<typeof fixedClock>;
  let wallet: DemoWallet;
  let uc: LoanUseCases;

  beforeEach(() => {
    clock = fixedClock(new Date('2026-01-01T00:00:00Z'));
    wallet = new DemoWallet(LENDER);
    uc = createLoanUseCases({ loanBook: new InMemoryLoanBook(clock), wallet, clock });
  });

  it('opens a loan, lets the borrower repay in instalments, and closes it', async () => {
    const opened = await uc.openLoan({ borrower: BORROWER, principal: ETH, feeBps: 100, termDays: 30 });
    expect(opened.ok).toBe(true);
    const id = opened.ok ? opened.value : '';

    wallet.switchTo(BORROWER);
    const due = totalDue({ principal: ETH, feeBps: 100 });
    expect((await uc.repayLoan({ id, amount: due / 2n })).ok).toBe(true);
    expect((await uc.repayLoan({ id, amount: due - due / 2n })).ok).toBe(true);

    const p = await uc.loadPortfolio();
    expect(p.ok && p.value.summary.outstandingPayable).toBe(0n);
  });

  it('never reaches the ledger when policy rejects the terms', async () => {
    const r = await uc.openLoan({ borrower: BORROWER, principal: ETH, feeBps: 5_000, termDays: 30 });
    expect(r).toMatchObject({ ok: false, error: { code: 'APR_ABOVE_CAP' } });
    const p = await uc.loadPortfolio();
    expect(p.ok && p.value.loans).toHaveLength(0);
  });

  it('flags overdue loans as time passes', async () => {
    await uc.openLoan({ borrower: BORROWER, principal: ETH, feeBps: 100, termDays: 30 });
    clock.advanceDays(45);
    const p = await uc.loadPortfolio();
    expect(p.ok && p.value.summary.portfolioAtRiskBps).toBe(10_000);
    expect(p.ok && p.value.summary.buckets['1-30']).toBe(1);
  });

  it('rejects repayment of an unknown loan', async () => {
    expect(await uc.repayLoan({ id: '99', amount: 1n })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
});
