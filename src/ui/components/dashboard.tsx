'use client';

import { useState } from 'react';
import { OpenLoanForm } from './open-loan-form';
import { LoanTable } from './loan-table';
import { PortfolioStats } from './portfolio-stats';
import { usePortfolio } from '../hooks/use-portfolio';
import { useContainer } from '../providers/container-provider';
import { shortAddress } from '../format';
import type { Address } from '@/core/domain/loan';

export function Dashboard() {
  const { mode, chain, demoWallet, demoIdentities = [] } = useContainer();
  const { state, refresh, connect } = usePortfolio();
  const [now] = useState(() => new Date());

  const account = state.status === 'ready' ? state.account : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pico Ledger</h1>
          <p className="text-sm text-slate-500">Peer-to-peer micro-loans with on-chain settlement and portfolio-at-risk reporting.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {mode === 'demo' ? 'Demo · in-memory adapter' : `On-chain · ${chain?.name}`}
          </span>
          {account ? (
            <span className="rounded-full bg-indigo-50 px-3 py-1 font-mono text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{shortAddress(account)}</span>
          ) : (
            <button onClick={() => void connect()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
              Connect wallet
            </button>
          )}
        </div>
      </header>

      {mode === 'demo' && demoWallet && account && (
        <DemoIdentitySwitcher
          account={account}
          identities={demoIdentities}
          onSwitch={async (a) => {
            demoWallet.switchTo(a);
            await refresh();
          }}
        />
      )}

      {state.status === 'loading' && <p className="text-sm text-slate-500">Loading portfolio…</p>}
      {state.status === 'disconnected' && <p className="text-sm text-slate-500">Connect a wallet to see your loans.</p>}
      {state.status === 'error' && <p role="alert" className="text-sm text-rose-600">{state.message}</p>}

      {state.status === 'ready' && (
        <div className="space-y-8">
          <PortfolioStats summary={state.summary} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <OpenLoanForm onOpened={refresh} />
            <section aria-labelledby="loans-heading" className="min-w-0">
              <h2 id="loans-heading" className="mb-3 text-base font-semibold">Your loans</h2>
              <LoanTable loans={state.loans} account={state.account} now={now} onChange={refresh} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoIdentitySwitcher({
  account,
  identities,
  onSwitch,
}: {
  account: Address;
  identities: { label: string; address: Address }[];
  onSwitch: (a: Address) => Promise<void>;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <span className="font-medium">Demo mode:</span> act as
      {identities.map((id) => (
        <button
          key={id.address}
          onClick={() => void onSwitch(id.address)}
          aria-pressed={account === id.address}
          className="rounded-md px-2 py-0.5 ring-1 ring-amber-300 aria-pressed:bg-amber-600 aria-pressed:text-white dark:ring-amber-800"
        >
          {id.label}
        </button>
      ))}
    </div>
  );
}
