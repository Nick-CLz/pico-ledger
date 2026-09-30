import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';

/** Starts a local Anvil node (from the @foundry-rs/anvil npm package) for the contract suite. */
export const ANVIL_PORT = 8546;
let proc: ChildProcess | undefined;

export async function setup() {
  const bin = createRequire(import.meta.url).resolve('@foundry-rs/anvil/bin.mjs');
  proc = spawn(process.execPath, [bin, '--port', String(ANVIL_PORT), '--silent'], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${ANVIL_PORT}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Anvil did not start');
}

export async function teardown() {
  proc?.kill();
}
