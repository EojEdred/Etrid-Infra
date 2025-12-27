/**
 * Register all 9 Director attesters in deployed AttesterRegistry contracts
 */

import { ethers } from 'ethers';

const CONFIG = {
  privateKey: '0x1b4734300c70328ac73f7b7bda27fca85c11ec6cebfd56fb77f147cad5d3faed',

  contracts: {
    base: {
      address: '0x94CB3aEB30f99A2baF4B02629f4c9876d41d77DE',
      rpc: 'https://mainnet.base.org',
      name: 'Base',
    },
    bsc: {
      address: '0x83Cbd7A2f40b945fc7E24bE555a55a048261C735',
      rpc: 'https://bsc-dataseed.binance.org',
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
};

const ABI = [
  'function registerAttester(address _attester) external',
  'function getAttesterCount() external view returns (uint256)',
  'function enabledAttesterCount() external view returns (uint256)',
  'function isEnabledAttester(address _attester) external view returns (bool)',
  'function getThreshold(uint32 _domain) external view returns (uint32, uint32)',
];

async function registerAttesters(network: { address: string; rpc: string; name: string }) {
  console.log(`\n═══ Registering Attesters on ${network.name} ═══\n`);
  console.log(`Contract: ${network.address}`);

  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
  const contract = new ethers.Contract(network.address, ABI, wallet);

  // Check current state
  const currentCount = await contract.getAttesterCount();
  console.log(`Current attester count: ${currentCount}\n`);

  let registered = 0;
  let skipped = 0;

  for (const attester of CONFIG.attesters) {
    process.stdout.write(`  ${attester.name} (${attester.address.slice(0, 10)}...): `);

    try {
      // Check if already registered
      const isEnabled = await contract.isEnabledAttester(attester.address);
      if (isEnabled) {
        console.log('Already registered ✓');
        skipped++;
        continue;
      }

      // Register
      const tx = await contract.registerAttester(attester.address);
      await tx.wait();
      console.log(`Registered! TX: ${tx.hash.slice(0, 20)}...`);
      registered++;

      // Small delay
      await new Promise(r => setTimeout(r, 500));

    } catch (error: any) {
      if (error.message.includes('AttesterAlreadyRegistered')) {
        console.log('Already registered ✓');
        skipped++;
      } else {
        console.log(`Failed: ${error.message.slice(0, 50)}`);
      }
    }
  }

  // Verify final state
  const finalCount = await contract.getAttesterCount();
  const enabledCount = await contract.enabledAttesterCount();
  const [minSig, total] = await contract.getThreshold(0);

  console.log(`\n${network.name} Summary:`);
  console.log(`  Total attesters: ${finalCount}`);
  console.log(`  Enabled: ${enabledCount}`);
  console.log(`  Threshold: ${minSig}-of-${total}`);
  console.log(`  New registrations: ${registered}`);
  console.log(`  Already registered: ${skipped}`);

  return { registered, skipped, total: Number(finalCount) };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ËTRID Attester Registration');
  console.log('═══════════════════════════════════════════════════════════');

  const baseResult = await registerAttesters(CONFIG.contracts.base);
  const bscResult = await registerAttesters(CONFIG.contracts.bsc);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Final Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\nBase: ${baseResult.total} attesters registered`);
  console.log(`BSC:  ${bscResult.total} attesters registered`);
  console.log('\nAttester Registration Complete! ✓');
}

main().catch(console.error);
