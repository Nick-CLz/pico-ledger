// Deploy PicoLoanBook to a testnet.
//   RPC_URL=https://... PRIVATE_KEY=0x... node scripts/deploy-contract.mjs
// Uses a throwaway testnet key only. Never put a funded mainnet key in an env file.
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'node:fs';

const { RPC_URL, PRIVATE_KEY } = process.env;
if (!RPC_URL || !PRIVATE_KEY) {
  console.error('Set RPC_URL and PRIVATE_KEY (testnet only).');
  process.exit(1);
}

// Read the generated artifact without a TS toolchain.
const src = readFileSync(new URL('../src/adapters/evm/generated/PicoLoanBook.ts', import.meta.url), 'utf8');
const abi = JSON.parse(src.match(/PicoLoanBookAbi = ([\s\S]*?) as const;/)[1]);
const bytecode = src.match(/PicoLoanBookBytecode = '(0x[0-9a-f]+)'/)[1];

const account = privateKeyToAccount(PRIVATE_KEY);
const transport = http(RPC_URL);
const pub = createPublicClient({ transport });
const chainId = await pub.getChainId();
const wallet = createWalletClient({ account, transport, chain: { id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } } });

// 36% p.a. cap, 7–365 day terms — keep in sync with DEFAULT_POLICY in src/core/domain/policy.ts
const hash = await wallet.deployContract({ abi, bytecode, args: [3600n, 7n, 365n] });
console.log('tx', hash);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log(`PicoLoanBook deployed on chain ${chainId} at ${receipt.contractAddress}`);
console.log(`Set NEXT_PUBLIC_LOANBOOK_ADDRESS=${receipt.contractAddress} to use it.`);
