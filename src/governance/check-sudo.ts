/**
 * Check sudo key and balances on Primearc chain
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  console.log('Connecting to Primearc...');
  const provider = new WsProvider('ws://100.71.127.127:9944');
  const api = await ApiPromise.create({ provider });

  console.log('Connected!\n');

  // Query sudo key
  const sudoKey = await api.query.sudo.key();
  console.log('Sudo key holder:', sudoKey.toHuman());

  // Check some account balances
  const accounts = [
    ['Alice', '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'],
    ['Gizzi Session', '5Dd8AjjuwKDP8P8sDguiiNKfADAXrACramNbWvLcdLEpGaPJ'],
    ['Gizzi Payment', '5HQMqpWrZU1AdN2WumX2Fv8EphJUgiF6fmyMZr94HH31kVQd'],
    ['EOJ Session', '5HYpUK51E1BzhEfiRikhjkNivJiw2WAEG5Uxsrbj5ZE669EM'],
    ['EOJ Payment', '5FxK7yqRNYsqsMxqpQttQGg1hqQ1yTEZUuyizM6NhBmZZJpD'],
    ['DAO Treasury', '5GBq8WgTBzf6mfyu5qP9JFgJeJt8oFobGpDKjbkSxkn7cQ5K'],
  ];

  console.log('\nAccount balances:');
  for (const [name, address] of accounts) {
    try {
      const account = await api.query.system.account(address) as any;
      const free = account.data?.free || account.free || 0;
      const balance = Number(free) / 1e12;
      console.log(`  ${name} (${address.slice(0,10)}...): ${balance.toFixed(2)} ETR`);
    } catch (e: any) {
      console.log(`  ${name}: error - ${e.message}`);
    }
  }

  await api.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
