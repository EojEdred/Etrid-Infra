/**
 * Check available governance and admin pallets on Primearc
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  console.log('Connecting to Primearc...');
  const provider = new WsProvider('ws://100.71.127.127:9944');
  const api = await ApiPromise.create({ provider });

  console.log('Connected!\n');

  // Get runtime metadata
  const metadata = await api.rpc.state.getMetadata();
  const pallets = metadata.asLatest.pallets;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Available Pallets on Primearc');
  console.log('═══════════════════════════════════════════════════════════\n');

  const palletNames: string[] = [];
  pallets.forEach((pallet: any) => {
    palletNames.push(pallet.name.toString());
  });

  // Sort and display
  palletNames.sort().forEach(name => {
    console.log(`  - ${name}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Governance-Related Pallets');
  console.log('═══════════════════════════════════════════════════════════\n');

  const governanceKeywords = ['democracy', 'council', 'collective', 'treasury', 'governance', 'sudo', 'multisig', 'proxy', 'utility'];

  const governancePallets = palletNames.filter(name =>
    governanceKeywords.some(keyword => name.toLowerCase().includes(keyword))
  );

  if (governancePallets.length > 0) {
    governancePallets.forEach(name => {
      console.log(`  ✓ ${name}`);
    });
  } else {
    console.log('  No governance pallets found');
  }

  // Check if bridgeAttestation pallet exists
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Bridge Attestation Pallet Status');
  console.log('═══════════════════════════════════════════════════════════\n');

  const hasBridgeAttestation = palletNames.some(name =>
    name.toLowerCase().includes('bridgeattestation') || name.toLowerCase().includes('bridge_attestation')
  );

  if (hasBridgeAttestation) {
    console.log('  ✓ BridgeAttestation pallet is available');

    // Check available calls
    if (api.tx.bridgeAttestation) {
      console.log('\n  Available calls:');
      Object.keys(api.tx.bridgeAttestation).forEach(call => {
        console.log(`    - bridgeAttestation.${call}`);
      });
    }

    // Check storage
    if (api.query.bridgeAttestation) {
      console.log('\n  Available storage:');
      Object.keys(api.query.bridgeAttestation).forEach(storage => {
        console.log(`    - bridgeAttestation.${storage}`);
      });

      // Try to read current attesters
      try {
        if (api.query.bridgeAttestation.attesters) {
          const attesters = await api.query.bridgeAttestation.attesters.entries();
          console.log(`\n  Registered attesters: ${attesters.length}`);
        }
        if (api.query.bridgeAttestation.attesterCount) {
          const count = await api.query.bridgeAttestation.attesterCount();
          console.log(`  Attester count: ${count.toString()}`);
        }
      } catch (e) {
        console.log('  Could not query attester state');
      }
    }
  } else {
    console.log('  ✗ BridgeAttestation pallet NOT found in runtime');
    console.log('  → Runtime upgrade required to add the pallet');
  }

  // Check sudo status
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Sudo Status');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (api.query.sudo) {
    const sudoKey = await api.query.sudo.key();
    console.log(`  Sudo key holder: ${sudoKey.toHuman()}`);

    // Check if it's a multisig
    const sudoAddress = sudoKey.toString();
    if (api.query.multisig) {
      try {
        const multisigs = await api.query.multisig.multisigs.entries();
        const isMultisig = multisigs.some(([key]) => key.args[0]?.toString() === sudoAddress);
        console.log(`  Is multisig: ${isMultisig ? 'Yes' : 'No/Unknown'}`);
      } catch (e) {
        console.log('  Could not check multisig status');
      }
    }
  } else {
    console.log('  Sudo pallet not available');
  }

  // Provide recommendations
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Recommendations');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!hasBridgeAttestation) {
    console.log('  1. The BridgeAttestation pallet needs to be added to the runtime');
    console.log('  2. This requires a runtime upgrade via sudo');
    console.log('  3. Options:');
    console.log('     a) Find the sudo key seed phrase');
    console.log('     b) Use governance (if available) to change sudo key');
    console.log('     c) Hard fork with new genesis including attesters');
  } else {
    console.log('  1. BridgeAttestation pallet exists - can register attesters');
    console.log('  2. Registration requires admin/sudo origin');
  }

  await api.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
