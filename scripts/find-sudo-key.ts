/**
 * Attempt to identify sudo key by checking common derivation paths
 */

import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();

  const targetAddress = '5HCvaHrCfXDasyQNRCdJ4jRtcwMmdkPDZEAF3LqF77qf5JtP';
  console.log(`Target sudo address: ${targetAddress}\n`);

  const keyring = new Keyring({ type: 'sr25519' });

  // Check well-known dev accounts
  const devAccounts = [
    '//Alice',
    '//Bob',
    '//Charlie',
    '//Dave',
    '//Eve',
    '//Ferdie',
    '//Alice//stash',
    '//Bob//stash',
    '//root',
    '//sudo',
    '//admin',
  ];

  console.log('Checking dev derivation paths...');
  for (const path of devAccounts) {
    const pair = keyring.addFromUri(path);
    if (pair.address === targetAddress) {
      console.log(`\n✓ FOUND! Derivation path: ${path}`);
      console.log(`  Address: ${pair.address}`);
      return;
    }
  }

  // Check common test mnemonics
  const testMnemonics = [
    // Substrate dev mnemonic
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk',
    // Another common test mnemonic
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  ];

  console.log('\nChecking test mnemonics with common paths...');
  const paths = ['', '//sudo', '//0', '//1', '//root', '//admin', '/m/44\'/60\'/0\'/0/0'];

  for (const mnemonic of testMnemonics) {
    for (const path of paths) {
      try {
        const pair = keyring.addFromUri(`${mnemonic}${path}`);
        if (pair.address === targetAddress) {
          console.log(`\n✓ FOUND!`);
          console.log(`  Mnemonic: ${mnemonic}`);
          console.log(`  Path: ${path || '(no path)'}`);
          console.log(`  Address: ${pair.address}`);
          return;
        }
      } catch (e) {
        // Skip invalid paths
      }
    }
  }

  // Check the seeds from .env.mainnet
  const knownSeeds = [
    // GIZZI seeds
    'hope inject assume uniform attack stereo joke order few couch educate human',
    // Add any other known seeds here
  ];

  console.log('\nChecking known seeds from .env.mainnet...');
  for (const seed of knownSeeds) {
    for (const path of ['', '//sudo', '//0', '//root', '//admin']) {
      try {
        const pair = keyring.addFromUri(`${seed}${path}`);
        console.log(`  ${seed.slice(0, 20)}...${path || '(root)'}: ${pair.address}`);
        if (pair.address === targetAddress) {
          console.log(`\n✓ FOUND!`);
          console.log(`  Seed: ${seed}`);
          console.log(`  Path: ${path || '(no path)'}`);
          return;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  // Try ed25519 as well
  const keyringEd = new Keyring({ type: 'ed25519' });
  console.log('\nChecking ed25519 derivations...');
  for (const path of devAccounts) {
    try {
      const pair = keyringEd.addFromUri(path);
      if (pair.address === targetAddress) {
        console.log(`\n✓ FOUND (ed25519)! Derivation path: ${path}`);
        return;
      }
    } catch (e) {
      // Skip
    }
  }

  console.log('\n✗ Could not identify sudo key from common derivations');
  console.log('\nThe key may have been:');
  console.log('  1. Generated with a unique seed phrase');
  console.log('  2. A randomly generated key');
  console.log('  3. From an external tool/wallet');
  console.log('\nRecommendations:');
  console.log('  - Check password managers or secure storage');
  console.log('  - Ask team members who set up the genesis');
  console.log('  - Check backup files or documentation');
}

main().catch(console.error);
