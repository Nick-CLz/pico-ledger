'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Address, Loan } from '@/core/domain/loan';
import type { PortfolioSummary } from '@/core/domain/portfolio';
import { describeViolation } from '@/core/domain/policy';
import type { UseCaseError } from '@/core/usecases/loan-use-cases';
import { useContainer } from '../providers/container-provider';

export function describeError(e: UseCaseError): string {
  if (e.code === 'NOT_CONNECTED') return 'Connect a wallet to continue.';
  if (e.code === 'NOT_FOUND') return 'Loan not found.';
  return describeViolation(e);
}

type State =
  | { status: 'loading' }
  | { status: 'disconnected' }
  | { status: 'ready'; account: Address; loans: Loan[]; summary: PortfolioSummary }
  | { status: 'error'; message: string };

/** Thin React binding over the portfolio use case. No business logic lives here. */
export function usePortfolio() {
  const { useCases } = useContainer();
  const [state, setState] = useState<State>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const res = await useCases.loadPortfolio();
      if (res.ok) setState({ status: 'ready', ...res.value });
      else if (res.error.code === 'NOT_CONNECTED') setState({ status: 'disconnected' });
      else setState({ status: 'error', message: describeError(res.error) });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Unexpected error' });
    }
  }, [useCases]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    await useCases.connect();
    await refresh();
  }, [useCases, refresh]);

  return { state, refresh, connect };
}
