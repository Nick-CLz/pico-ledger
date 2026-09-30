import type { PortfolioSummary, DpdBucket } from '@/core/domain/portfolio';
import { formatEth, pct } from '../format';

const BUCKETS: DpdBucket[] = ['CURRENT', '1-30', '31-60', '61-90', '90+'];
const BUCKET_TONE: Record<DpdBucket, string> = {
  CURRENT: 'bg-emerald-500',
  '1-30': 'bg-amber-400',
  '31-60': 'bg-orange-500',
  '61-90': 'bg-rose-500',
  '90+': 'bg-rose-700',
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function PortfolioStats({ summary }: { summary: PortfolioSummary }) {
  const activeLoans = BUCKETS.reduce((n, b) => n + summary.buckets[b], 0);
  const parTone = summary.portfolioAtRiskBps > 1_000 ? 'text-rose-600' : 'text-emerald-600';

  return (
    <section aria-labelledby="portfolio-heading" className="space-y-4">
      <h2 id="portfolio-heading" className="sr-only">Portfolio summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receivable" value={`${formatEth(summary.outstandingReceivable)} ETH`} hint={`${formatEth(summary.totalLent)} ETH lent`} />
        <Stat label="Payable" value={`${formatEth(summary.outstandingPayable)} ETH`} hint={`${formatEth(summary.totalBorrowed)} ETH borrowed`} />
        <Stat label="Loans" value={String(summary.loanCount)} hint={`${activeLoans} open as lender`} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Portfolio at risk</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${parTone}`}>{pct(summary.portfolioAtRiskBps)}</p>
          <p className="mt-1 text-xs text-slate-500">Overdue share of receivable</p>
        </div>
      </div>

      {activeLoans > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Days past due (open loans)</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label="Delinquency distribution">
            {BUCKETS.map((b) =>
              summary.buckets[b] ? (
                <div key={b} className={BUCKET_TONE[b]} style={{ width: `${(summary.buckets[b] / activeLoans) * 100}%` }} />
              ) : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
            {BUCKETS.map((b) => (
              <li key={b} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${BUCKET_TONE[b]}`} />
                {b === 'CURRENT' ? 'Current' : `${b} days`}: <span className="tabular-nums">{summary.buckets[b]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
