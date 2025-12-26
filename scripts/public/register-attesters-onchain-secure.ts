/**
 * ËTRID On-Chain Attester Registration Script (Secure Version)
 *
 * Registers all 9 Director attesters on-chain using pallet_bridge_attestation
 * Requires sudo/root origin to execute.
 * Uses external configuration instead of hardcoded secrets.
 *
 * Usage:
 *   npx ts-node scripts/public/register-attesters-onchain-secure.ts [--testnet]
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import * as fs from 'fs';
import * as path from 'path';

// Configuration using environment variables
const CONFIG = {
  // Primearc RPC endpoints - use environment variable or default
  mainnet: process.env.PRIMEARC_RPC_URL || 'ws://127.0.0.1:9944',
  testnet: process.env.PRIMEARC_TESTNET_RPC_URL || 'ws://127.0.0.1:9944',

  // Sudo seed from environment variable
  sudoSeed: process.env.SUDO_SEED || '',

  // Keys file - use environment variable or default secure location
  keysFile: process.env.ATTESTER_KEYS_FILE || './config/secure/attester-keys.json',

  // Threshold configuration
  threshold: parseInt(process.env.ATTESTER_THRESHOLD || '5', 10), // 5-of-9 by default
};

interface AttesterKey {
  id: number;
  name: string;
  publicKey: string;
  address: string;
  enabled: boolean;
}

interface KeysFile {
  attesters: AttesterKey[];
  configuration: {
    threshold: number;
    total: number;
  };
}

// Colors for console output
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

async function main() {
  const isTestnet = process.argv.includes('--testnet');
  const wsUrl = isTestnet ? CONFIG.testnet : CONFIG.mainnet;

  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.blue, '   ËTRID On-Chain Attester Registration (Secure Version)');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.cyan, `Network: ${isTestnet ? 'TESTNET' : 'MAINNET'}`);
  log(colors.cyan, `RPC: ${wsUrl}`);

  // Validate required environment variables
  if (!CONFIG.sudoSeed) {
    log(colors.red, 'ERROR: SUDO_SEED environment variable is not set');
    log(colors.yellow, 'Please set SUDO_SEED with your sudo account seed');
    process.exit(1);
  }

  // Wait for crypto
  await cryptoWaitReady();

  // Load attester keys
  log(colors.yellow, `\nLoading attester keys from: ${CONFIG.keysFile}`);
  if (!fs.existsSync(CONFIG.keysFile)) {
    log(colors.red, `ERROR: Keys file not found: ${CONFIG.keysFile}`);
    log(colors.yellow, 'Please ensure your attester keys are in the secure location');
    process.exit(1);
  }

  const keysData: KeysFile = JSON.parse(fs.readFileSync(CONFIG.keysFile, 'utf8'));
  log(colors.green, `Loaded ${keysData.attesters.length} attesters`);

  // Connect to chain
  log(colors.yellow, '\nConnecting to chain...');
  const provider = new WsProvider(wsUrl);
  const api = await ApiPromise.create({ provider });

  const chain = await api.rpc.system.chain();
  const version = await api.rpc.system.version();
  log(colors.green, `Connected to: ${chain} (${version})`);

  // Check if pallet_bridge_attestation exists
  if (!api.tx.bridgeAttestation) {
    log(colors.red, 'ERROR: pallet_bridge_attestation not found in runtime');
    log(colors.yellow, 'Make sure the runtime includes the bridge attestation pallet');
    await api.disconnect();
    process.exit(1);
  }

  // Setup sudo account
  const keyring = new Keyring({ type: 'sr25519' });
  const sudo = keyring.addFromUri(CONFIG.sudoSeed);
  log(colors.cyan, `\nSudo account: ${sudo.address}`);

  // Check sudo balance
  const { data: balance } = await api.query.system.account(sudo.address) as any;
  const freeBalance = balance.free.toBigInt();
  log(colors.cyan, `Balance: ${Number(freeBalance) / 1e12} ETR`);

  if (freeBalance < 1_000_000_000_000n) {
    log(colors.red, 'WARNING: Low balance - may not have enough for transaction fees');
  }

  // Register each attester
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.blue, '   Registering Attesters');
  log(colors.blue, '═══════════════════════════════════════════════════════════\n');

  const results: { id: number; success: boolean; hash?: string; error?: string }[] = [];

  for (const attester of keysData.attesters) {
    log(colors.yellow, `\nRegistering Attester-${attester.id}: ${attester.name}`);
    log(colors.cyan, `  Public Key: ${attester.publicKey}`);
    log(colors.cyan, `  EVM Address: ${attester.address}`);
    log(colors.cyan, `  Enabled: ${attester.enabled}`);

    try {
      // Convert public key to bytes (remove 0x prefix)
      const publicKeyBytes = attester.publicKey.startsWith('0x')
        ? attester.publicKey.slice(2)
        : attester.publicKey;

      // Create the register_attester call
      // The pallet expects only: (public_key)
      const registerCall = api.tx.bridgeAttestation.registerAttester(
        `0x${publicKeyBytes}`
      );

      // Wrap in sudo call (requires root origin)
      const sudoCall = api.tx.sudo.sudo(registerCall);

      // Sign and send
      const hash = await new Promise<string>((resolve, reject) => {
        sudoCall.signAndSend(sudo, { nonce: -1 }, ({ status, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
            } else {
              resolve(status.asInBlock.toString());
            }
          }
        }).catch(reject);
      });

      log(colors.green, `  ✓ Registered! Block: ${hash}`);
      results.push({ id: attester.id, success: true, hash });

      // Small delay between transactions
      await new Promise(r => setTimeout(r, 1000));

    } catch (error: any) {
      log(colors.red, `  ✗ Failed: ${error.message}`);
      results.push({ id: attester.id, success: false, error: error.message });
    }
  }

  // Update threshold - try both function names
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.yellow, `Setting attestation threshold to ${CONFIG.threshold}-of-${keysData.attesters.length}`);

  try {
    // Try updateThreshold first, then configureThreshold
    let thresholdCall;
    if (api.tx.bridgeAttestation.updateThreshold) {
      thresholdCall = api.tx.bridgeAttestation.updateThreshold(CONFIG.threshold);
    } else if (api.tx.bridgeAttestation.configureThreshold) {
      // configureThreshold(domain_id, min_signatures, total_attesters)
      thresholdCall = api.tx.bridgeAttestation.configureThreshold(null, CONFIG.threshold, keysData.attesters.length);
    } else {
      throw new Error('No threshold update function available');
    }

    const sudoThreshold = api.tx.sudo.sudo(thresholdCall);

    const hash = await new Promise<string>((resolve, reject) => {
      sudoThreshold.signAndSend(sudo, { nonce: -1 }, ({ status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
          } else {
            resolve(status.asInBlock.toString());
          }
        }
      }).catch(reject);
    });

    log(colors.green, `✓ Threshold updated! Block: ${hash}`);
  } catch (error: any) {
    log(colors.yellow, `Threshold update skipped: ${error.message}`);
  }

  // Summary
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.blue, '   Registration Summary');
  log(colors.blue, '═══════════════════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  log(colors.green, `Successful: ${successful}`);
  log(colors.red, `Failed: ${failed}`);

  if (failed > 0) {
    log(colors.yellow, '\nFailed registrations:');
    results.filter(r => !r.success).forEach(r => {
      log(colors.red, `  Attester-${r.id}: ${r.error}`);
    });
  }

  // Verify registrations
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.yellow, 'Verifying on-chain registrations...\n');

  try {
    // Query registered attesters
    if (api.query.bridgeAttestation.attesters) {
      const attesters = await api.query.bridgeAttestation.attesters.entries();
      log(colors.cyan, `On-chain attesters: ${attesters.length}`);

      for (const [key, value] of attesters) {
        const attesterId = key.args[0]?.toString() || 'unknown';
        const attesterData = value.toHuman();
        log(colors.green, `  Attester ${attesterId}: ${JSON.stringify(attesterData)}`);
      }
    }

    // Query current threshold - try multiple storage names
    if (api.query.bridgeAttestation.signatureThreshold) {
      const threshold = await api.query.bridgeAttestation.signatureThreshold();
      log(colors.cyan, `\nCurrent threshold: ${threshold.toString()}`);
    } else if (api.query.bridgeAttestation.globalThreshold) {
      const threshold = await api.query.bridgeAttestation.globalThreshold();
      log(colors.cyan, `\nCurrent threshold: ${threshold.toHuman()}`);
    } else if (api.query.bridgeAttestation.attesterCount) {
      const count = await api.query.bridgeAttestation.attesterCount();
      log(colors.cyan, `\nRegistered attester count: ${count.toString()}`);
    }
  } catch (error: any) {
    log(colors.yellow, `Could not verify: ${error.message}`);
  }

  await api.disconnect();
  log(colors.green, '\nDone!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});