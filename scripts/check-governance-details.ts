/**
 * Check Governance pallet details on Primearc
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  console.log('Connecting to Primearc...');
  const provider = new WsProvider('ws://100.71.127.127:9944');
  const api = await ApiPromise.create({ provider });

  console.log('Connected!\n');

  // Check Governance pallet
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Governance Pallet');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (api.tx.governance) {
    console.log('Available calls:');
    Object.keys(api.tx.governance).forEach(call => {
      console.log(`  - governance.${call}`);
    });
  }

  if (api.query.governance) {
    console.log('\nAvailable storage:');
    Object.keys(api.query.governance).forEach(storage => {
      console.log(`  - governance.${storage}`);
    });
  }

  // Check ValidatorCommittee pallet
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   ValidatorCommittee Pallet');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (api.tx.validatorCommittee) {
    console.log('Available calls:');
    Object.keys(api.tx.validatorCommittee).forEach(call => {
      console.log(`  - validatorCommittee.${call}`);
    });
  }

  if (api.query.validatorCommittee) {
    console.log('\nAvailable storage:');
    Object.keys(api.query.validatorCommittee).forEach(storage => {
      console.log(`  - validatorCommittee.${storage}`);
    });

    // Try to get committee members
    try {
      if (api.query.validatorCommittee.members) {
        const members = await api.query.validatorCommittee.members();
        console.log(`\nCommittee members: ${members.toHuman()}`);
      }
    } catch (e) {
      console.log('Could not query members');
    }
  }

  // Check Multisig pallet
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Multisig Pallet');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (api.tx.multisig) {
    console.log('Available calls:');
    Object.keys(api.tx.multisig).forEach(call => {
      console.log(`  - multisig.${call}`);
    });
  }

  // Check current sudo key and known accounts
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Account Balances');
  console.log('═══════════════════════════════════════════════════════════\n');

  const accounts = [
    ['Sudo Key', '5HCvaHrCfXDasyQNRCdJ4jRtcwMmdkPDZEAF3LqF77qf5JtP'],
    ['Eoj Controller', '5HQTgrkRhd5h5VE2SsL76S9jAf2xZRCaEoVcFiyGxSPAFciq'],
    ['Gizzi Controller', '5CAyFg27EJwoTJcj1KHravoqjidEn4XqciKM5q9ukbVSzSbW'],
    ['Gizzi Session', '5Dd8AjjuwKDP8P8sDguiiNKfADAXrACramNbWvLcdLEpGaPJ'],
    ['Gizzi Payment', '5HQMqpWrZU1AdN2WumX2Fv8EphJUgiF6fmyMZr94HH31kVQd'],
    ['EOJ Session', '5HYpUK51E1BzhEfiRikhjkNivJiw2WAEG5Uxsrbj5ZE669EM'],
    ['EOJ Payment', '5FxK7yqRNYsqsMxqpQttQGg1hqQ1yTEZUuyizM6NhBmZZJpD'],
    ['DAO Treasury', '5GBq8WgTBzf6mfyu5qP9JFgJeJt8oFobGpDKjbkSxkn7cQ5K'],
  ];

  for (const [name, address] of accounts) {
    try {
      const account = await api.query.system.account(address) as any;
      const free = account.data?.free || account.free || 0;
      const balance = Number(free) / 1e12;
      console.log(`  ${name} (${address.slice(0,15)}...): ${balance.toFixed(4)} ETR`);
    } catch (e: any) {
      console.log(`  ${name}: error`);
    }
  }

  // Check if sudo key is a multisig derived address
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Sudo Key Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');

  const sudoKey = '5HCvaHrCfXDasyQNRCdJ4jRtcwMmdkPDZEAF3LqF77qf5JtP';

  // Check if there's a multisig at this address
  if (api.query.multisig && api.query.multisig.multisigs) {
    const multisigs = await api.query.multisig.multisigs.entries();
    console.log(`Total multisigs on chain: ${multisigs.length}`);

    if (multisigs.length > 0) {
      console.log('\nExisting multisigs:');
      for (const [key, value] of multisigs) {
        const multisigAddress = key.args[0]?.toString();
        const data = value.toHuman() as any;
        console.log(`  Address: ${multisigAddress?.slice(0, 20)}...`);
        console.log(`  Data: ${JSON.stringify(data)}`);
      }
    }
  }

  // Check if can use governance to change sudo
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Options to Register Attesters');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Option 1: Find sudo key seed phrase');
  console.log('  - Search backup files, password managers, or original setup docs');
  console.log('  - The key 5HCvaHrC... was set in genesis');
  console.log('');

  console.log('Option 2: Use Multisig if sudo is multisig');
  console.log('  - Need to derive multisig address from Eoj + Gizzi controllers');
  console.log('  - Check if derived address matches sudo key');
  console.log('');

  console.log('Option 3: Governance proposal (if supported)');
  console.log('  - Create proposal to register attesters');
  console.log('  - Requires governance mechanism to have root origin capability');
  console.log('');

  // Try to derive multisig address
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Multisig Address Derivation');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const { sortAddresses, createKeyMulti, encodeAddress } = await import('@polkadot/util-crypto');

    const eojController = '5HQTgrkRhd5h5VE2SsL76S9jAf2xZRCaEoVcFiyGxSPAFciq';
    const gizziController = '5CAyFg27EJwoTJcj1KHravoqjidEn4XqciKM5q9ukbVSzSbW';

    // Sort addresses (required for multisig)
    const sorted = sortAddresses([eojController, gizziController]);
    console.log('Sorted signatories:');
    sorted.forEach((addr, i) => console.log(`  ${i + 1}. ${addr}`));

    // Create 2-of-2 multisig
    const multisigPubKey = createKeyMulti(sorted, 2);
    const multisigAddress = encodeAddress(multisigPubKey, 42); // SS58 format

    console.log(`\nDerived 2-of-2 multisig: ${multisigAddress}`);
    console.log(`Current sudo key:        ${sudoKey}`);
    console.log(`Match: ${multisigAddress === sudoKey ? 'YES ✓' : 'NO ✗'}`);

  } catch (e: any) {
    console.log(`Could not derive multisig: ${e.message}`);
  }

  await api.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
