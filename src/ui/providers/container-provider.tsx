'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { buildContainer, type Container } from '@/composition/container';

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({ children }: { children: ReactNode }) {
  const container = useMemo(() => buildContainer(), []);
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): Container {
  const c = useContext(ContainerContext);
  if (!c) throw new Error('useContainer must be used inside <ContainerProvider>');
  return c;
}
