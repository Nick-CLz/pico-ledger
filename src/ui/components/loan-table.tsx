'use client';

import { useState } from 'react';
import { dueDate, outstanding, statusAt, totalDue, type Address, type Loan, type LoanStatus } from '@/core/domain/loan';
import { useContainer } from '../providers/container-provider';
import { describeError } from '../hooks/use-portfolio';
import { formatEth, parseEth, shortAddress } from '../format';

const STATUS_STYLE: Record<LoanStatus, string> = {
  ACTIVE: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300',
  OVERDUE: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-300',
  REPAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300',
};

function RepayControl({ loan, onDone }: { loan: Loan; onDone: () => Promise<void> }) {
  const { useCases } = useContainer();
  const [amount, setAmount] = useState(formatEth(outstanding(loan), 18));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const wei = parseEth(amount);
    if (wei === null) return setError('Enter a valid ETH amount.');
    setBusy(true);
    setError(null);
    try {
      const res = await useCases.repayLoan({ id: loan.id, amount: wei });
      if (!res.ok) setError(describeError(res.error));
      else await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`repay-${loan.id}`}>Repayment amount in ETH</label>
        <input
          id={`repay-${loan.id}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Repaying…' : 'Repay'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

export function LoanTable({ loans, account, now, onChange }: { loans: Loan[]; account: Address; now: Date; onChange: () => Promise<void> }) {
  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
        No loans yet. Open one above to get started.
      </div>
    );
  }
  const me = account.toLowerCase();

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="whitespace-nowrap bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-950">
          <tr>
            <th className="px-3 py-3">#</th>
            <th className="px-3 py-3">Role</th>
            <th className="px-3 py-3">Counterparty</th>
            <th className="px-3 py-3 text-right">Principal</th>
            <th className="px-3 py-3 text-right">Outstanding</th>
            <th className="px-3 py-3">Due</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loans.map((loan) => {
            const isBorrower = loan.borrower.toLowerCase() === me;
            const status = statusAt(loan, now);
            const bal = outstanding(loan);
            const paidShare = Number((loan.repaid * 100n) / totalDue(loan));
            return (
              <tr key={loan.id} className="align-middle">
                <td className="px-3 py-3 tabular-nums text-slate-500">{loan.id}</td>
                <td className="px-3 py-3">{isBorrower ? 'Borrower' : 'Lender'}</td>
                <td className="px-3 py-3 font-mono text-xs">{shortAddress(isBorrower ? loan.lender : loan.borrower)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatEth(loan.principal)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatEth(bal)}
                  <div className="ml-auto mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${Math.min(paidShare, 100)}%` }} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600 dark:text-slate-400">{dueDate(loan).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>{status}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  {isBorrower && bal > 0n ? <RepayControl loan={loan} onDone={onChange} /> : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
