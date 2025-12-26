/**
 * Example usage of AttestationSubmitter
 *
 * Demonstrates how to submit attestations to PBC chains
 */

import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { AttestationSubmitter } from './AttestationSubmitter';
import { AttestationSubmitterConfig, SubmitAttestationParams } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load PBC endpoints from config file
 */
function loadPbcConfig(): AttestationSubmitterConfig {
  const configPath = path.join(__dirname, '../../config/pbc-endpoints.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData);

  const chains: Record<string, any> = {};
  for (const [key, value] of Object.entries(config.chains)) {
    chains[key] = value;
  }

  return {
    chains,
    defaultRetries: 3,
    retryDelayMs: 2000,
    timeout: 60000,
  };
}

/**
 * Example 1: Submit attestation to Ethereum PBC
 */
async function example1_SubmitToEthereumPbc() {
  console.log('\n=== Example 1: Submit Attestation to Ethereum PBC ===\n');

  // Initialize crypto
  await cryptoWaitReady();

  // Load configuration
  const config = loadPbcConfig();

  // Create submitter
  const submitter = new AttestationSubmitter(config);

  // Create keyring and signer account
  const keyring = new Keyring({ type: 'sr25519' });
  const signer = keyring.addFromUri('//Alice'); // Use proper key in production

  console.log('Signer address:', signer.address);

  // Prepare attestation parameters
  const params: SubmitAttestationParams = {
    pbcEndpoint: config.chains['ethereum-pbc'].wsEndpoint,
    messageHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    signatures: [
      {
        attester: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', // Attester 1
        signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      },
      {
        attester: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', // Attester 2
        signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
    ],
    signerKeypair: signer,
  };

  try {
    // Submit attestation
    const result = await submitter.submitAttestation(params);

    console.log('\nSubmission result:', {
      success: result.success,
      txHash: result.txHash,
      blockHash: result.blockHash,
      blockNumber: result.blockNumber,
      error: result.error,
    });

    if (result.success) {
      console.log('\n✅ Attestation submitted successfully!');
      console.log('Transaction hash:', result.txHash);

      // Check attestation status
      console.log('\nChecking attestation status...');
      const status = await submitter.getAttestationStatus(
        params.pbcEndpoint,
        params.messageHash
      );

      if (status) {
        console.log('Attestation status:', {
          isVerified: status.isVerified,
          attestations: status.attestations,
          requiredAttestations: status.requiredAttestations,
          attesters: status.attesters,
        });
      }
    } else {
      console.error('\n❌ Attestation submission failed:', result.error);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  } finally {
    // Clean up
    await submitter.disconnectAll();
  }
}

/**
 * Example 2: Submit to multiple PBCs
 */
async function example2_SubmitToMultiplePbcs() {
  console.log('\n=== Example 2: Submit to Multiple PBCs ===\n');

  await cryptoWaitReady();

  const config = loadPbcConfig();
  const submitter = new AttestationSubmitter(config);

  const keyring = new Keyring({ type: 'sr25519' });
  const signer = keyring.addFromUri('//Alice');

  const messageHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const signatures = [
    {
      attester: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
  ];

  // Submit to multiple chains in parallel
  const chains = ['ethereum-pbc', 'solana-pbc', 'polygon-pbc'];
  const results = await Promise.all(
    chains.map((chain) =>
      submitter.submitAttestation({
        pbcEndpoint: config.chains[chain].wsEndpoint,
        messageHash,
        signatures,
        signerKeypair: signer,
      })
    )
  );

  console.log('\nSubmission results:');
  results.forEach((result, index) => {
    console.log(`\n${chains[index]}:`);
    console.log('  Success:', result.success);
    console.log('  TX Hash:', result.txHash || 'N/A');
    console.log('  Error:', result.error || 'None');
  });

  // Get stats
  const stats = submitter.getStats();
  console.log('\nSubmitter statistics:', stats);

  await submitter.disconnectAll();
}

/**
 * Example 3: Retry logic demonstration
 */
async function example3_RetryLogic() {
  console.log('\n=== Example 3: Retry Logic ===\n');

  await cryptoWaitReady();

  const config = loadPbcConfig();
  const submitter = new AttestationSubmitter(config);

  const keyring = new Keyring({ type: 'sr25519' });
  const signer = keyring.addFromUri('//Alice');

  const params: SubmitAttestationParams = {
    pbcEndpoint: config.chains['bitcoin-pbc'].wsEndpoint,
    messageHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    signatures: [
      {
        attester: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      },
    ],
    signerKeypair: signer,
  };

  const options = {
    maxRetries: 5,
    retryDelay: 1000,
    waitForFinalization: true,
  };

  console.log('Submitting with retry options:', options);

  try {
    const result = await submitter.submitAttestation(params, options);
    console.log('\nResult:', result);
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await submitter.disconnectAll();
  }
}

/**
 * Example 4: Check attestation status
 */
async function example4_CheckStatus() {
  console.log('\n=== Example 4: Check Attestation Status ===\n');

  await cryptoWaitReady();

  const config = loadPbcConfig();
  const submitter = new AttestationSubmitter(config);

  const messageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const pbcEndpoint = config.chains['solana-pbc'].wsEndpoint;

  try {
    console.log('Checking status for message:', messageHash);
    console.log('On chain:', pbcEndpoint);

    const status = await submitter.getAttestationStatus(pbcEndpoint, messageHash);

    if (status) {
      console.log('\nAttestation Status:');
      console.log('  Message Hash:', status.messageHash);
      console.log('  Is Verified:', status.isVerified);
      console.log('  Attestations Received:', status.attestations);
      console.log('  Required Attestations:', status.requiredAttestations);
      console.log('  Attesters:', status.attesters);
      console.log(
        '  Status:',
        status.isVerified
          ? '✅ VERIFIED'
          : `⏳ PENDING (${status.attestations}/${status.requiredAttestations})`
      );
    } else {
      console.log('\n⚠️ No attestation data found for this message hash');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await submitter.disconnectAll();
  }
}

/**
 * Example 5: List configured chains
 */
async function example5_ListChains() {
  console.log('\n=== Example 5: List Configured Chains ===\n');

  const config = loadPbcConfig();
  const submitter = new AttestationSubmitter(config);

  const chains = submitter.getConfiguredChains();

  console.log('Configured PBC Chains:');
  chains.forEach((chainName) => {
    const chainConfig = config.chains[chainName];
    console.log(`\n${chainName}:`);
    console.log('  Name:', chainConfig.name);
    console.log('  WebSocket:', chainConfig.wsEndpoint);
    console.log('  HTTP:', chainConfig.httpEndpoint);
    console.log('  Chain ID:', chainConfig.chainId);
    console.log('  Enabled:', chainConfig.enabled);
  });

  console.log('\nTotal chains:', chains.length);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || '1';

  switch (example) {
    case '1':
      await example1_SubmitToEthereumPbc();
      break;
    case '2':
      await example2_SubmitToMultiplePbcs();
      break;
    case '3':
      await example3_RetryLogic();
      break;
    case '4':
      await example4_CheckStatus();
      break;
    case '5':
      await example5_ListChains();
      break;
    case 'all':
      await example5_ListChains();
      await example1_SubmitToEthereumPbc();
      await example2_SubmitToMultiplePbcs();
      await example4_CheckStatus();
      break;
    default:
      console.log('Usage: ts-node example.ts [1|2|3|4|5|all]');
      console.log('  1 - Submit to Ethereum PBC');
      console.log('  2 - Submit to multiple PBCs');
      console.log('  3 - Retry logic demonstration');
      console.log('  4 - Check attestation status');
      console.log('  5 - List configured chains');
      console.log('  all - Run all examples');
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export {
  example1_SubmitToEthereumPbc,
  example2_SubmitToMultiplePbcs,
  example3_RetryLogic,
  example4_CheckStatus,
  example5_ListChains,
};
