import type { Address, Chain, PublicClient, Transport, WalletClient, Account } from 'viem';
import type { Loan, LoanId } from '@/core/domain/loan';
import type { LoanTerms } from '@/core/domain/policy';
import type { LoanBookPort } from '@/core/ports';
import { PicoLoanBookAbi } from './generated/PicoLoanBook';

/**
 * LoanBookPort backed by the PicoLoanBook contract.
 *
 * This is the only file that knows about ABIs, gas, or tuple layouts; the
 * rest of the app sees plain `Loan` objects. Maps on-chain structs to the
 * domain model and waits for receipts so callers can re-read immediately.
 */
export class EvmLoanBook implements LoanBookPort {
  constructor(
    private readonly address: Address,
    private readonly publicClient: PublicClient<Transport, Chain>,
    /** Resolved per write, so the signer is whichever account is connected right now. */
    private readonly getSigner?: () => Promise<WalletClient<Transport, Chain, Account>>,
  ) {}

  async listFor(account: Address): Promise<Loan[]> {
    const ids = await this.publicClient.readContract({
      address: this.address,
      abi: PicoLoanBookAbi,
      functionName: 'loansOf',
      args: [account],
    });
    const unique = [...new Set(ids.map(String))];
    const loans = await Promise.all(unique.map((id) => this.get(id)));
    return loans.filter((l): l is Loan => l !== null);
  }

  async get(id: LoanId): Promise<Loan | null> {
    try {
      const raw = await this.publicClient.readContract({
        address: this.address,
        abi: PicoLoanBookAbi,
        functionName: 'getLoan',
        args: [BigInt(id)],
      });
      return {
        id,
        lender: raw.lender,
        borrower: raw.borrower,
        principal: raw.principal,
        repaid: raw.repaid,
        feeBps: raw.feeBps,
        termDays: raw.termDays,
        startedAt: new Date(Number(raw.startedAt) * 1000),
      };
    } catch {
      return null;
    }
  }

  async open(terms: LoanTerms): Promise<LoanId> {
    const wallet = await this.requireSigner();
    const { request, result } = await this.publicClient.simulateContract({
      account: wallet.account,
      address: this.address,
      abi: PicoLoanBookAbi,
      functionName: 'open',
      args: [terms.borrower, terms.feeBps, terms.termDays],
      value: terms.principal,
    });
    const hash = await wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash });
    return result.toString();
  }

  async repay(id: LoanId, _payer: Address, amount: bigint): Promise<void> {
    const wallet = await this.requireSigner();
    const { request } = await this.publicClient.simulateContract({
      account: wallet.account,
      address: this.address,
      abi: PicoLoanBookAbi,
      functionName: 'repay',
      args: [BigInt(id)],
      value: amount,
    });
    const hash = await wallet.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash });
  }

  private async requireSigner() {
    if (!this.getSigner) throw new Error('EvmLoanBook: a signer is required for writes');
    return this.getSigner();
  }
}
