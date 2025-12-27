/**
 * ËTRID Attester Funding Script
 *
 * Funds all 9 Director attester EVM addresses with ETH and BNB for gas fees.
 * Uses the MetaMask private key from .env.mainnet
 *
 * Usage:
 *   npx ts-node scripts/fund-attesters.ts [--check-only] [--network eth|bnb|both]
 */

import { ethers } from 'ethers';
import * as fs from 'fs';

// Configuration
const CONFIG = {
  // MetaMask private key from .env.mainnet
  fundingKey: '0x1b4734300c70328ac73f7b7bda27fca85c11ec6cebfd56fb77f147cad5d3faed',

  // RPC endpoints
  ethereum: {
    rpc: 'https://mainnet.base.org', // Using Base for lower fees
    name: 'Ethereum (Base)',
    symbol: 'ETH',
    fundingAmount: '0.001', // 0.001 ETH per attester (~$3, enough for hundreds of txs on Base)
  },
  bsc: {
    rpc: 'https://bsc-dataseed.binance.org',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    fundingAmount: '0.002', // 0.002 BNB per attester (~$1.20, enough for many txs)
  },

  // Attester addresses
  attesters: [
    { id: 1, name: 'Director-1', address: '0xA12d48dB2589cfe7ff11a595b80013CffFf5eE3d' },
    { id: 2, name: 'Director-2', address: '0x18a6034995CC0c6Db7fC9Ee53E535f5b1984f83e' },
    { id: 3, name: 'Director-3', address: '0x574B03172d7e637e2aA645eA9789Fe1E36DdBE33' },
    { id: 4, name: 'Director-4', address: '0x698AEdAd3550e716eDA5C923950caC3aA163883F' },
    { id: 5, name: 'Director-5', address: '0xa27f49Bf5a5daa961fECF86526bDa0FD315bE988' },
    { id: 6, name: 'Director-6', address: '0x6250F01Ca6fcCeB81a1c7E5c2f8A114511188934' },
    { id: 7, name: 'Director-7', address: '0x56824F247Bbb54c353025306E860E8edA8877c7b' },
    { id: 8, name: 'Director-8', address: '0x64810209643c663D0505806e66Fe5dc0C5cEdB37' },
    { id: 9, name: 'Director-9 (backup)', address: '0x3D9f108A558f9DDDc3c0881d6eafF7292d64dF92' },
  ],
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

interface NetworkConfig {
  rpc: string;
  name: string;
  symbol: string;
  fundingAmount: string;
}

async function checkBalances(network: NetworkConfig): Promise<void> {
  log(colors.blue, `\n═══ ${network.name} Balances ═══\n`);

  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(CONFIG.fundingKey, provider);

  // Check funding wallet balance
  const fundingBalance = await provider.getBalance(wallet.address);
  log(colors.cyan, `Funding Wallet (${wallet.address.slice(0,10)}...): ${ethers.formatEther(fundingBalance)} ${network.symbol}`);

  // Check each attester balance
  for (const attester of CONFIG.attesters) {
    const balance = await provider.getBalance(attester.address);
    const balanceEther = ethers.formatEther(balance);
    const status = parseFloat(balanceEther) > 0 ? colors.green : colors.yellow;
    console.log(`  ${attester.name}: ${status}${balanceEther} ${network.symbol}${colors.reset}`);
  }
}

async function fundAttesters(network: NetworkConfig): Promise<{ success: number; failed: number }> {
  log(colors.blue, `\n═══ Funding on ${network.name} ═══\n`);

  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(CONFIG.fundingKey, provider);

  // Check funding wallet balance
  const fundingBalance = await provider.getBalance(wallet.address);
  const required = ethers.parseEther(network.fundingAmount) * BigInt(CONFIG.attesters.length);

  log(colors.cyan, `Funding wallet: ${wallet.address}`);
  log(colors.cyan, `Balance: ${ethers.formatEther(fundingBalance)} ${network.symbol}`);
  log(colors.cyan, `Required (${CONFIG.attesters.length} x ${network.fundingAmount}): ${ethers.formatEther(required)} ${network.symbol}`);

  if (fundingBalance < required) {
    log(colors.red, `\nInsufficient balance! Need at least ${ethers.formatEther(required)} ${network.symbol}`);
    return { success: 0, failed: CONFIG.attesters.length };
  }

  let success = 0;
  let failed = 0;

  for (const attester of CONFIG.attesters) {
    process.stdout.write(`  ${attester.name} (${attester.address.slice(0,10)}...): `);

    try {
      // Check if already funded
      const currentBalance = await provider.getBalance(attester.address);
      if (currentBalance >= ethers.parseEther(network.fundingAmount)) {
        console.log(`${colors.green}Already funded (${ethers.formatEther(currentBalance)} ${network.symbol})${colors.reset}`);
        success++;
        continue;
      }

      // Send funding
      const tx = await wallet.sendTransaction({
        to: attester.address,
        value: ethers.parseEther(network.fundingAmount),
      });

      await tx.wait();
      console.log(`${colors.green}Funded! TX: ${tx.hash.slice(0,20)}...${colors.reset}`);
      success++;

      // Small delay between transactions
      await new Promise(r => setTimeout(r, 1000));

    } catch (error: any) {
      console.log(`${colors.red}Failed: ${error.message.slice(0,50)}${colors.reset}`);
      failed++;
    }
  }

  return { success, failed };
}

async function main() {
  const checkOnly = process.argv.includes('--check-only');
  const networkArg = process.argv.find(a => a.startsWith('--network='))?.split('=')[1] || 'both';

  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.blue, '   ËTRID Attester Funding Script');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.cyan, `Mode: ${checkOnly ? 'Check balances only' : 'Fund attesters'}`);
  log(colors.cyan, `Networks: ${networkArg}`);

  const networks: NetworkConfig[] = [];
  if (networkArg === 'eth' || networkArg === 'both') {
    networks.push(CONFIG.ethereum);
  }
  if (networkArg === 'bnb' || networkArg === 'both') {
    networks.push(CONFIG.bsc);
  }

  if (checkOnly) {
    // Just check balances
    for (const network of networks) {
      await checkBalances(network);
    }
  } else {
    // Fund attesters
    const results: { network: string; success: number; failed: number }[] = [];

    for (const network of networks) {
      const result = await fundAttesters(network);
      results.push({ network: network.name, ...result });
    }

    // Summary
    log(colors.blue, '\n═══════════════════════════════════════════════════════════');
    log(colors.blue, '   Funding Summary');
    log(colors.blue, '═══════════════════════════════════════════════════════════\n');

    for (const r of results) {
      log(colors.cyan, `${r.network}:`);
      log(colors.green, `  Successful: ${r.success}`);
      if (r.failed > 0) log(colors.red, `  Failed: ${r.failed}`);
    }
  }

  log(colors.green, '\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
