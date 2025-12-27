/**
 * Check attester balances on Base and BSC
 */

import { ethers } from 'ethers';

const ATTESTERS = [
  { id: 1, name: 'Director-1', address: '0xA12d48dB2589cfe7ff11a595b80013CffFf5eE3d' },
  { id: 2, name: 'Director-2', address: '0x18a6034995CC0c6Db7fC9Ee53E535f5b1984f83e' },
  { id: 3, name: 'Director-3', address: '0x574B03172d7e637e2aA645eA9789Fe1E36DdBE33' },
  { id: 4, name: 'Director-4', address: '0x698AEdAd3550e716eDA5C923950caC3aA163883F' },
  { id: 5, name: 'Director-5', address: '0xa27f49Bf5a5daa961fECF86526bDa0FD315bE988' },
  { id: 6, name: 'Director-6', address: '0x6250F01Ca6fcCeB81a1c7E5c2f8A114511188934' },
  { id: 7, name: 'Director-7', address: '0x56824F247Bbb54c353025306E860E8edA8877c7b' },
  { id: 8, name: 'Director-8', address: '0x64810209643c663D0505806e66Fe5dc0C5cEdB37' },
  { id: 9, name: 'Director-9', address: '0x3D9f108A558f9DDDc3c0881d6eafF7292d64dF92' },
];

async function main() {
  const baseProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const bscProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Attester Balances');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Base (ETH):');
  for (const a of ATTESTERS) {
    const bal = await baseProvider.getBalance(a.address);
    const status = bal > 0n ? '✓' : '✗';
    console.log(`  ${status} ${a.name}: ${ethers.formatEther(bal)} ETH`);
  }

  console.log('\nBSC (BNB):');
  for (const a of ATTESTERS) {
    const bal = await bscProvider.getBalance(a.address);
    const status = bal > 0n ? '✓' : '✗';
    console.log(`  ${status} ${a.name}: ${ethers.formatEther(bal)} BNB`);
  }
}

main().catch(console.error);
