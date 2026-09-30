import type { Address } from '@/core/domain/loan';
import type { WalletPort } from '@/core/ports';

/** Pre-connected wallet for the offline demo. Can "switch" identity to act as a borrower. */
export class DemoWallet implements WalletPort {
  readonly kind = 'demo' as const;
  constructor(private account: Address) {}
  async current() {
    return this.account;
  }
  async connect() {
    return this.account;
  }
  switchTo(account: Address) {
    this.account = account;
  }
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** Browser wallet (MetaMask, Rabby, ...) via EIP-1193. */
export class InjectedWallet implements WalletPort {
  readonly kind = 'injected' as const;
  constructor(private readonly provider: Eip1193Provider) {}

  async current(): Promise<Address | null> {
    const accounts = (await this.provider.request({ method: 'eth_accounts' })) as Address[];
    return accounts[0] ?? null;
  }

  async connect(): Promise<Address> {
    const accounts = (await this.provider.request({ method: 'eth_requestAccounts' })) as Address[];
    if (!accounts[0]) throw new Error('Wallet returned no accounts');
    return accounts[0];
  }
}
