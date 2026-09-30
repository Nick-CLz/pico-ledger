'use client';

import dynamic from 'next/dynamic';
import { ContainerProvider } from '@/ui/providers/container-provider';

// The container inspects window.ethereum, so the dashboard renders client-side only
// to avoid a server/client adapter mismatch during hydration.
const Dashboard = dynamic(() => import('@/ui/components/dashboard').then((m) => m.Dashboard), {
  ssr: false,
  loading: () => <p className="p-8 text-sm text-slate-500">Loading…</p>,
});

export function App() {
  return (
    <ContainerProvider>
      <Dashboard />
    </ContainerProvider>
  );
}
