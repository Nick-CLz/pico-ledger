import { beforeEach, describe, expect, it } from 'vitest';
import {
  createPublicClient, createWalletClient, getAddress, http, parseEther,
  type Address, type Chain, type PublicClient, type Transport,
} from 'viem';
import { foundry } from 'viem/chains';
import { PicoLoanBookAbi, PicoLoanBookBytecode } from '@/adapters/evm/generated/PicoLoanBook';
import { EvmLoanBook } from '@/adapters/evm/evm-loan-book';
import { createLoanUseCases } from '@/core/usecases/loan-use-cases';
import { fixedClock } from '@/adapters/clock/clocks';
import { totalDue } from '@/core/domain/loan';

import { ANVIL_PORT } from './anvil.global-setup';

/**
 * Runs the real contract on a local Anvil node and drives it through the
 * same EvmLoanBook adapter the app uses. Each test deploys a fresh contract.
 */
const chain: Chain = foundry;

async function setup() {
  const transport = http(`http://127.0.0.1:${ANVIL_PORT}`);
  const accounts = (await createPublicClient({ chain, transport }).request({ method: 'eth_accounts' as never })) as Address[];
  const [lender, borrower, stranger] = accounts.map((a) => getAddress(a));
  const pub = createPublicClient({ chain, transport }) as PublicClient<Transport, Chain>;
  const as = (account: Address) => createWalletClient({ account, chain, transport });

  const hash = await as(lender).deployContract({
    abi: PicoLoanBookAbi, bytecode: PicoLoanBookBytecode, args: [3600n, 7n, 365n],
  });
  const address = (await pub.waitForTransactionReceipt({ hash })).contractAddress!;

  /** Simulate (surfaces custom-error reverts), then send and wait. */
  async function send(from: Address, functionName: 'open' | 'repay', args: readonly unknown[], value: bigint) {
    const { request } = await pub.simulateContract({ account: from, address, abi: PicoLoanBookAbi, functionName, args: args as never, value });
    const receipt = await pub.waitForTransactionReceipt({ hash: await as(from).writeContract(request) });
    if (receipt.status !== 'success') throw new Error('reverted');
    return receipt;
  }

  return { pub, as, send, address, lender, borrower, stranger };
}

type Env = Awaited<ReturnType<typeof setup>>;

describe('PicoLoanBook', () => {
  let env: Env;
  beforeEach(async () => { env = await setup(); });

  const open = (e: Env, value = parseEther('1'), feeBps = 200, termDays = 30) =>
    e.send(e.lender, 'open', [e.borrower, feeBps, termDays], value);

  it('disburses principal to the borrower and records the loan', async () => {
    const before = await env.pub.getBalance({ address: env.borrower });
    await open(env);
    expect((await env.pub.getBalance({ address: env.borrower })) - before).toBe(parseEther('1'));

    const loan = await env.pub.readContract({ address: env.address, abi: PicoLoanBookAbi, functionName: 'getLoan', args: [0n] });
    expect(loan).toMatchObject({ lender: env.lender, borrower: env.borrower, principal: parseEther('1'), feeBps: 200, termDays: 30 });
    expect(await env.pub.readContract({ address: env.address, abi: PicoLoanBookAbi, functionName: 'outstanding', args: [0n] })).toBe(parseEther('1.02'));
  });

  it('enforces the APR cap with the same rounding as the TS domain', async () => {
    await expect(open(env, parseEther('1'), 300, 30)).rejects.toThrow(/AprAboveCap/);
    await expect(open(env, parseEther('1'), 3600, 365)).resolves.toBeTruthy(); // exactly at cap
  });

  it('rejects self-loans, zero principal and out-of-range terms', async () => {
    await expect(env.send(env.lender, 'open', [env.lender, 100, 30], 1n)).rejects.toThrow(/SelfLoan/);
    await expect(open(env, 0n)).rejects.toThrow(/ZeroPrincipal/);
    await expect(open(env, parseEther('1'), 10, 3)).rejects.toThrow(/TermOutOfRange/);
  });

  it('routes repayments to the lender and blocks non-borrowers and overpayment', async () => {
    await open(env);
    const repay = (from: Address, value: bigint) => env.send(from, 'repay', [0n], value);

    await expect(repay(env.stranger, parseEther('0.1'))).rejects.toThrow(/NotBorrower/);
    await expect(repay(env.borrower, parseEther('1.03'))).rejects.toThrow(/InvalidAmount/);

    const before = await env.pub.getBalance({ address: env.lender });
    await repay(env.borrower, parseEther('1.02'));
    expect((await env.pub.getBalance({ address: env.lender })) - before).toBe(parseEther('1.02'));
    expect(await env.pub.readContract({ address: env.address, abi: PicoLoanBookAbi, functionName: 'outstanding', args: [0n] })).toBe(0n);
  });

  it('works end-to-end through the EvmLoanBook adapter and use cases', async () => {
    const signer = (a: Address) => async () => env.as(a);
    const lenderBook = new EvmLoanBook(env.address, env.pub, signer(env.lender));
    const borrowerBook = new EvmLoanBook(env.address, env.pub, signer(env.borrower));
    const wallet = (a: Address) => ({ kind: 'demo' as const, current: async () => a, connect: async () => a });
    const clock = fixedClock(new Date());

    const lenderUc = createLoanUseCases({ loanBook: lenderBook, wallet: wallet(env.lender), clock });
    const borrowerUc = createLoanUseCases({ loanBook: borrowerBook, wallet: wallet(env.borrower), clock });

    const opened = await lenderUc.openLoan({ borrower: env.borrower, principal: parseEther('0.5'), feeBps: 100, termDays: 30 });
    expect(opened).toEqual({ ok: true, value: '0' });

    const due = totalDue({ principal: parseEther('0.5'), feeBps: 100 });
    expect(await borrowerUc.repayLoan({ id: '0', amount: due })).toEqual({ ok: true, value: undefined });

    const p = await lenderUc.loadPortfolio();
    expect(p.ok && p.value.summary.totalLent).toBe(parseEther('0.5'));
    expect(p.ok && p.value.summary.outstandingReceivable).toBe(0n);
  });
});
