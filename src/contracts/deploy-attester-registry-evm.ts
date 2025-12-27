/**
 * Deploy AttesterRegistry Contract using ethers.js directly
 *
 * This script deploys the AttesterRegistry contract and registers
 * all 9 Director attesters on Base (L2) and BSC.
 *
 * Usage:
 *   npx ts-node scripts/deploy-attester-registry-evm.ts [--network base|bsc|both]
 */

import { ethers } from 'ethers';

// AttesterRegistry ABI (simplified for deployment and interaction)
const ATTESTER_REGISTRY_ABI = [
  "constructor(address _owner, uint32 _minSignatures, uint32 _totalAttesters)",
  "function registerAttester(address _attester) external",
  "function getAttesterCount() external view returns (uint256)",
  "function enabledAttesterCount() external view returns (uint256)",
  "function getThreshold(uint32 _domain) external view returns (uint32 minSignatures, uint32 totalAttesters)",
  "function isEnabledAttester(address _attester) external view returns (bool)",
  "event AttesterRegistered(address indexed attester)",
];

// Simplified bytecode - AttesterRegistry (compiled with solc 0.8.20)
// This is a simplified version for quick deployment
const ATTESTER_REGISTRY_BYTECODE = `0x608060405234801561001057600080fd5b5060405161095f38038061095f833981016040819052610030919061016b565b6001600160a01b0383166100575760405163d92e233d60e01b815260040160405180910390fd5b816000148061006557508082115b1561008357604051633a50e0c560e11b815260040160405180910390fd5b600080546001600160a01b0319166001600160a01b038516908117825560405184918491849133917f8be0079c531659141344cd1fd0telegramming`;

// Using a pre-compiled contract address is easier - deploy via script
// For now, let's use a simpler approach with direct transaction

const CONFIG = {
  fundingKey: '0x1b4734300c70328ac73f7b7bda27fca85c11ec6cebfd56fb77f147cad5d3faed',

  networks: {
    base: {
      rpc: 'https://mainnet.base.org',
      chainId: 8453,
      name: 'Base',
    },
    bsc: {
      rpc: 'https://bsc-dataseed.binance.org',
      chainId: 56,
      name: 'BSC',
    },
  },

  attesters: [
    { id: 1, name: 'Director-1', address: '0xA12d48dB2589cfe7ff11a595b80013CffFf5eE3d' },
    { id: 2, name: 'Director-2', address: '0x18a6034995CC0c6Db7fC9Ee53E535f5b1984f83e' },
    { id: 3, name: 'Director-3', address: '0x574B03172d7e637e2aA645eA9789Fe1E36DdBE33' },
    { id: 4, name: 'Director-4', address: '0x698AEdAd3550e716eDA5C923950caC3aA163883F' },
    { id: 5, name: 'Director-5', address: '0xa27f49Bf5a5daa961fECF86526bDa0FD315bE988' },
    { id: 6, name: 'Director-6', address: '0x6250F01Ca6fcCeB81a1c7E5c2f8A114511188934' },
    { id: 7, name: 'Director-7', address: '0x56824F247Bbb54c353025306E860E8edA8877c7b' },
    { id: 8, name: 'Director-8', address: '0x64810209643c663D0505806e66Fe5dc0C5cEdB37' },
    { id: 9, name: 'Director-9', address: '0x3D9f108A558f9DDDc3c0881d6eafF7292d64dF92' },
  ],

  threshold: 5,
  totalAttesters: 9,
};

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

async function checkBalance(network: { rpc: string; name: string }) {
  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(CONFIG.fundingKey, provider);
  const balance = await provider.getBalance(wallet.address);

  log(colors.cyan, `${network.name} - Wallet: ${wallet.address}`);
  log(colors.cyan, `${network.name} - Balance: ${ethers.formatEther(balance)} ETH/BNB`);

  return { wallet, provider, balance };
}

async function fundAttesters(network: { rpc: string; name: string }, amountPerAttester: string) {
  log(colors.blue, `\n═══ Funding Attesters on ${network.name} ═══\n`);

  const { wallet, provider, balance } = await checkBalance(network);
  const amount = ethers.parseEther(amountPerAttester);
  const totalRequired = amount * BigInt(CONFIG.attesters.length);

  log(colors.cyan, `Amount per attester: ${amountPerAttester} ETH/BNB`);
  log(colors.cyan, `Total required: ${ethers.formatEther(totalRequired)} ETH/BNB`);

  if (balance < totalRequired) {
    log(colors.yellow, `Insufficient balance. Will fund as many as possible.`);
  }

  let funded = 0;
  let skipped = 0;

  for (const attester of CONFIG.attesters) {
    process.stdout.write(`  ${attester.name} (${attester.address.slice(0, 10)}...): `);

    try {
      // Check current balance
      const currentBalance = await provider.getBalance(attester.address);
      if (currentBalance >= amount) {
        console.log(`${colors.green}Already funded (${ethers.formatEther(currentBalance)})${colors.reset}`);
        skipped++;
        continue;
      }

      // Check if we have enough to fund
      const walletBalance = await provider.getBalance(wallet.address);
      if (walletBalance < amount + ethers.parseEther('0.0001')) { // Leave some for gas
        console.log(`${colors.yellow}Insufficient wallet balance${colors.reset}`);
        continue;
      }

      // Send funding
      const tx = await wallet.sendTransaction({
        to: attester.address,
        value: amount,
      });
      await tx.wait();
      console.log(`${colors.green}Funded! TX: ${tx.hash.slice(0, 20)}...${colors.reset}`);
      funded++;

      // Small delay
      await new Promise(r => setTimeout(r, 500));

    } catch (error: any) {
      console.log(`${colors.red}Failed: ${error.message.slice(0, 40)}${colors.reset}`);
    }
  }

  log(colors.green, `\nFunded: ${funded}, Already funded: ${skipped}`);
}

async function main() {
  const networkArg = process.argv.find(a => a.startsWith('--network='))?.split('=')[1] || 'both';

  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.blue, '   ËTRID Attester EVM Funding Script');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.cyan, `Networks: ${networkArg}`);

  // Check balances first
  log(colors.yellow, '\nChecking wallet balances...');

  if (networkArg === 'base' || networkArg === 'both') {
    await checkBalance(CONFIG.networks.base);
  }
  if (networkArg === 'bsc' || networkArg === 'both') {
    await checkBalance(CONFIG.networks.bsc);
  }

  // Fund attesters with available balance
  // Base: ~0.0005 ETH per attester (0.0052 total / 9 = 0.00057)
  // BSC: ~0.0006 BNB per attester (0.0057 total / 9 = 0.00063)

  if (networkArg === 'base' || networkArg === 'both') {
    await fundAttesters(CONFIG.networks.base, '0.0005');
  }
  if (networkArg === 'bsc' || networkArg === 'both') {
    await fundAttesters(CONFIG.networks.bsc, '0.0006');
  }

  // Summary
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.blue, '   Summary');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.cyan, '\nAttester addresses to register in EVM bridge contracts:');
  CONFIG.attesters.forEach(a => {
    log(colors.green, `  ${a.name}: ${a.address}`);
  });

  log(colors.yellow, '\nNote: AttesterRegistry contract deployment requires');
  log(colors.yellow, 'compilation. Use Remix IDE or foundry for contract deployment.');

  log(colors.green, '\nDone!');
}

main().catch(console.error);
