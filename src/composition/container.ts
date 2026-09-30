import { createPublicClient, createWalletClient, custom, http, type Address, type Chain } from 'viem';
import { foundry, sepolia, baseSepolia } from 'viem/chains';
import { createLoanUseCases, type LoanUseCases } from '@/core/usecases/loan-use-cases';
import { InMemoryLoanBook } from '@/adapters/in-memory/in-memory-loan-book';
import { DEMO_ACCOUNT, DEMO_IDENTITIES, demoSeed } from '@/adapters/in-memory/demo-seed';
import { EvmLoanBook } from '@/adapters/evm/evm-loan-book';
import { DemoWallet, InjectedWallet } from '@/adapters/wallet/wallets';
import { systemClock } from '@/adapters/clock/clocks';

/**
 * Composition root: the ONLY place that picks concrete adapters.
 * Everything above this line in the dependency graph talks to ports.
 */

export type AppMode = 'demo' | 'onchain';

export interface Container {
  mode: AppMode;
  useCases: LoanUseCases;
  chain?: Chain;
  demoWallet?: DemoWallet;
  demoIdentities?: { label: string; address: Address }[];
}

const CHAINS: Record<string, Chain> = { sepolia, baseSepolia, anvil: foundry };

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

export function buildContainer(): Container {
  const address = process.env.NEXT_PUBLIC_LOANBOOK_ADDRESS as Address | undefined;
  const chain = CHAINS[process.env.NEXT_PUBLIC_CHAIN ?? 'sepolia'] ?? sepolia;
  const ethereum = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined;

  if (address && ethereum) {
    const publicClient = createPublicClient({ chain, transport: http() });
    const wallet = new InjectedWallet(ethereum);
    const loanBook = new EvmLoanBook(address, publicClient, async () => {
      const account = (await wallet.current()) ?? (await wallet.connect());
      return createWalletClient({ account, chain, transport: custom(ethereum) });
    });
    return { mode: 'onchain', chain, useCases: createLoanUseCases({ loanBook, wallet, clock: systemClock }) };
  }

  const demoWallet = new DemoWallet(DEMO_ACCOUNT);
  const loanBook = new InMemoryLoanBook(systemClock, demoSeed(systemClock.now()));
  return { mode: 'demo', demoWallet, demoIdentities: DEMO_IDENTITIES, useCases: createLoanUseCases({ loanBook, wallet: demoWallet, clock: systemClock }) };
}
