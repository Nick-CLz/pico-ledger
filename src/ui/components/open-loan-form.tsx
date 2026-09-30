'use client';

import { useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { annualisedRateBps, totalDue, type Address } from '@/core/domain/loan';
import { useContainer } from '../providers/container-provider';
import { describeError } from '../hooks/use-portfolio';
import { formatEth, parseEth, pct } from '../format';

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950';

export function OpenLoanForm({ onOpened }: { onOpened: () => Promise<void> }) {
  const { useCases } = useContainer();
  const { maxAprBps, minTermDays, maxTermDays } = useCases.policy;
  const [borrower, setBorrower] = useState('');
  const [principal, setPrincipal] = useState('0.1');
  const [feeBps, setFeeBps] = useState('150');
  const [termDays, setTermDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);

  // Live preview straight from the domain functions — same maths the use case and contract enforce.
  const preview = useMemo(() => {
    const wei = parseEth(principal);
    const fee = Number(feeBps);
    const term = Number(termDays);
    if (wei === null || !Number.isInteger(fee) || !Number.isInteger(term) || term <= 0) return null;
    return { repay: totalDue({ principal: wei, feeBps: fee }), aprBps: annualisedRateBps(fee, term) };
  }, [principal, feeBps, termDays]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const wei = parseEth(principal);
    if (!isAddress(borrower)) return setMessage({ tone: 'error', text: 'Borrower must be a valid 0x address.' });
    if (wei === null) return setMessage({ tone: 'error', text: 'Enter a valid principal in ETH.' });
    setBusy(true);
    try {
      const res = await useCases.openLoan({ borrower: borrower as Address, principal: wei, feeBps: Number(feeBps), termDays: Number(termDays) });
      if (!res.ok) setMessage({ tone: 'error', text: describeError(res.error) });
      else {
        setMessage({ tone: 'ok', text: `Loan #${res.value} opened.` });
        setBorrower('');
        await onOpened();
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : 'Transaction failed' });
    } finally {
      setBusy(false);
    }
  }

  const overCap = preview !== null && preview.aprBps > maxAprBps;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold">Open a loan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Disburse ETH to a borrower. Term {minTermDays}–{maxTermDays} days, implied APR capped at {pct(maxAprBps)}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">
          Borrower address
          <input className={`${inputCls} font-mono`} value={borrower} onChange={(e) => setBorrower(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
        </label>
        <label className="block text-sm font-medium">
          Principal (ETH)
          <input className={inputCls} value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block text-sm font-medium">
          Term (days)
          <input className={inputCls} value={termDays} onChange={(e) => setTermDays(e.target.value)} inputMode="numeric" />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Flat fee (basis points of principal)
          <input className={inputCls} value={feeBps} onChange={(e) => setFeeBps(e.target.value)} inputMode="numeric" />
        </label>
      </div>

      {preview && (
        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950">
          <dt className="text-slate-500">Borrower repays</dt>
          <dd className="text-right tabular-nums">{formatEth(preview.repay)} ETH</dd>
          <dt className="text-slate-500">Implied APR</dt>
          <dd className={`text-right tabular-nums ${overCap ? 'font-semibold text-rose-600' : ''}`}>{pct(preview.aprBps)}</dd>
        </dl>
      )}

      <button
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? 'Waiting for confirmation…' : 'Open loan'}
      </button>
      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${message.tone === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
