/**
 * Check Primearc chain state to determine if genesis restart is viable
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  console.log('Connecting to Primearc...');
  const provider = new WsProvider('ws://100.71.127.127:9944');
  const api = await ApiPromise.create({ provider });

  console.log('Connected!\n');

  // Get chain info
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Chain State Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');

  const chain = await api.rpc.system.chain();
  const header = await api.rpc.chain.getHeader();
  const genesisHash = api.genesisHash.toHex();

  console.log(`Chain: ${chain}`);
  console.log(`Genesis hash: ${genesisHash}`);
  console.log(`Current block: ${header.number.toNumber()}`);

  // Calculate age
  const blockNumber = header.number.toNumber();
  const avgBlockTime = 6; // seconds
  const ageSeconds = blockNumber * avgBlockTime;
  const ageDays = ageSeconds / 86400;

  console.log(`Estimated chain age: ${ageDays.toFixed(1)} days (~${blockNumber * avgBlockTime / 3600} hours)`);

  // Check account counts
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Account Statistics');
  console.log('═══════════════════════════════════════════════════════════\n');

  const accounts = await api.query.system.account.entries();
  console.log(`Total accounts with data: ${accounts.length}`);

  // Count accounts with balance
  let accountsWithBalance = 0;
  for (const [, accountInfo] of accounts) {
    const data = (accountInfo as any).data;
    if (data && data.free && !data.free.isZero()) {
      accountsWithBalance++;
    }
  }
  console.log(`Accounts with balance: ${accountsWithBalance}`);

  // Check treasury
  if (api.query.etridTreasury) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   Treasury Status');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      const treasuryAccount = '5GBq8WgTBzf6mfyu5qP9JFgJeJt8oFobGpDKjbkSxkn7cQ5K';
      const treasury = await api.query.system.account(treasuryAccount) as any;
      const balance = Number(treasury.data.free) / 1e12;
      console.log(`DAO Treasury balance: ${balance.toLocaleString()} ETR`);
    } catch (e) {
      console.log('Could not query treasury');
    }
  }

  // Check consensus state
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Consensus/Validator State');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (api.query.session) {
    const currentIndex = await api.query.session.currentIndex();
    console.log(`Session index: ${currentIndex.toString()}`);

    const validators = await api.query.session.validators();
    console.log(`Active validators: ${(validators as any).length}`);
  }

  // Recommendation
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Recommendation');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (blockNumber < 1000) {
    console.log('✓ Chain is VERY NEW (<1000 blocks)');
    console.log('  → Genesis restart is viable without significant state loss');
  } else if (blockNumber < 100000) {
    console.log('⚠️ Chain has moderate history');
    console.log('  → Genesis restart would lose some state but may be acceptable');
  } else {
    console.log('✗ Chain has significant history');
    console.log('  → Genesis restart would cause major disruption');
    console.log('  → Find sudo key or implement governance upgrade');
  }

  // Check if there are any transactions/events
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   Practical Option');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Since sudo key is unknown and chain is in production:');
  console.log('');
  console.log('OPTION A - Add to genesis and restart (if acceptable):');
  console.log('  1. Update genesis preset with bridge_attestation config');
  console.log('  2. Include all 9 Director attesters');
  console.log('  3. Set 5-of-9 threshold');
  console.log('  4. Restart all validators with new genesis');
  console.log('');
  console.log('OPTION B - Find sudo key:');
  console.log('  1. Check password managers (Bitwarden, 1Password, etc.)');
  console.log('  2. Ask team members who set up genesis');
  console.log('  3. Check encrypted backups referenced in docs');
  console.log('     - sudo-backup-gizzi.txt.gpg');
  console.log('     - sudo-backup-eojedred.txt.gpg');

  await api.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
