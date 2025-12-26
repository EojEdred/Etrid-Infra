/**
 * TRON MONITOR - USAGE EXAMPLES
 *
 * Production examples for integrating TronMonitor with ËTRID bridge relayer
 */

import { TronMonitor, createTronMonitor, TrxDepositEvent, Trc20DepositEvent } from './TronMonitor';
import { logger } from '../utils/logger';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

/**
 * EXAMPLE 1: Basic TRON Monitor Setup (Mainnet)
 */
async function example1_BasicSetup() {
  logger.info('Example 1: Basic TRON Monitor Setup');

  // Create monitor with default configuration for mainnet
  const monitor = createTronMonitor(
    'TYourBridgeContractAddress', // Replace with actual bridge contract
    'mainnet',
    {
      tronGridApiKey: process.env.TRONGRID_API_KEY, // Recommended for production
      pollIntervalMs: 3000, // 3 seconds (TRON block time)
      minConfirmations: 19, // Super representative finality
    }
  );

  // Listen for TRX deposits
  monitor.on('trxDeposit', async (event: TrxDepositEvent) => {
    logger.info('TRX Deposit detected!', {
      depositor: event.tronAddress,
      etridAccount: Buffer.from(event.etridAccount).toString('hex'),
      amountTRX: (Number(event.amount) / 1_000_000).toFixed(6),
      txId: event.txId,
      confirmations: event.confirmations,
    });

    // TODO: Submit to ËTRID runtime
    // await submitTrxDepositToEtrid(event);
  });

  // Listen for TRC-20 deposits
  monitor.on('trc20Deposit', async (event: Trc20DepositEvent) => {
    logger.info('TRC-20 Deposit detected!', {
      token: event.tokenSymbol,
      depositor: event.tronAddress,
      amount: event.amount.toString(),
      txId: event.txId,
    });

    // TODO: Submit to ËTRID runtime
    // await submitTokenDepositToEtrid(event);
  });

  // Listen for USDT deposits (special handling)
  monitor.on('usdtDeposit', async (event: Trc20DepositEvent) => {
    logger.info('USDT Deposit detected! (High priority - 63% of global USDT)', {
      depositor: event.tronAddress,
      amountUSDT: (Number(event.amount) / 1_000_000).toFixed(6),
      txId: event.txId,
    });

    // TODO: Fast-track USDT deposit to ËTRID runtime
    // await submitUsdtDepositToEtrid(event);
  });

  // Handle errors
  monitor.on('error', (error) => {
    logger.error('TRON Monitor error', error);
  });

  // Start monitoring
  await monitor.start();

  logger.info('TRON Monitor started successfully');
  logger.info('Status:', monitor.getStatus());
}

/**
 * EXAMPLE 2: Complete Bridge Relayer Integration
 */
async function example2_FullIntegration() {
  logger.info('Example 2: Full Bridge Relayer Integration');

  // Initialize Polkadot.js connection to ËTRID runtime
  await cryptoWaitReady();

  const provider = new WsProvider(process.env.ETRID_WS_URL || 'ws://localhost:9944');
  const api = await ApiPromise.create({ provider });

  // Create keyring for signing transactions
  const keyring = new Keyring({ type: 'sr25519' });
  const relayerAccount = keyring.addFromUri(process.env.RELAYER_SEED || '//Alice');

  logger.info('Connected to ËTRID runtime', {
    chain: (await api.rpc.system.chain()).toString(),
    relayerAddress: relayerAccount.address,
  });

  // Create TRON monitor
  const monitor = createTronMonitor(
    process.env.TRON_BRIDGE_CONTRACT!,
    'mainnet',
    {
      tronGridApiKey: process.env.TRONGRID_API_KEY,
      pollIntervalMs: 3000,
      minConfirmations: 19,
    }
  );

  // Handle TRX deposits
  monitor.on('trxDeposit', async (event: TrxDepositEvent) => {
    try {
      logger.info('Processing TRX deposit', {
        txId: event.txId,
        amount: event.amount.toString(),
      });

      // Convert TRON address to hex (21 bytes)
      const tronAddressHex = monitor.addressToHex(event.tronAddress);
      const tronAddressBytes = monitor.getAddressBytes(event.tronAddress);

      // Submit initiate_trx_deposit extrinsic to ËTRID
      const tx = api.tx.tronBridge.initiateTrxDeposit(
        event.etridAccount, // etrid_account (32 bytes)
        Array.from(tronAddressBytes), // tron_address (21 bytes)
        event.amount.toString(), // amount in SUN
        event.txId, // tx_id (32 bytes hex)
        event.blockNumber, // block_height
        event.confirmations // confirmations
      );

      // Sign and send
      await tx.signAndSend(relayerAccount, ({ status, events }) => {
        if (status.isInBlock) {
          logger.info('TRX deposit submitted to ËTRID', {
            txId: event.txId,
            blockHash: status.asInBlock.toString(),
          });

          // Check for errors
          events.forEach(({ event: { method, section } }) => {
            if (section === 'system' && method === 'ExtrinsicFailed') {
              logger.error('Extrinsic failed', { txId: event.txId });
            }
          });
        } else if (status.isFinalized) {
          logger.info('TRX deposit finalized in ËTRID', {
            txId: event.txId,
            blockHash: status.asFinalized.toString(),
          });

          // Now submit confirm_trx_deposit after confirmations
          if (event.confirmations >= 19) {
            setTimeout(async () => {
              await confirmTrxDeposit(api, relayerAccount, event.txId);
            }, 30000); // Wait 30 seconds for runtime to process
          }
        }
      });

    } catch (error) {
      logger.error('Error processing TRX deposit', { event, error });
    }
  });

  // Handle TRC-20 deposits
  monitor.on('trc20Deposit', async (event: Trc20DepositEvent) => {
    try {
      logger.info('Processing TRC-20 deposit', {
        token: event.tokenSymbol,
        txId: event.txId,
        amount: event.amount.toString(),
      });

      // Convert addresses
      const tronAddressBytes = monitor.getAddressBytes(event.tronAddress);
      const tokenContractBytes = monitor.getAddressBytes(event.tokenContract);

      // Submit initiate_token_deposit extrinsic
      const tx = api.tx.tronBridge.initiateTokenDeposit(
        event.etridAccount,
        Array.from(tronAddressBytes),
        Array.from(tokenContractBytes),
        event.amount.toString(),
        event.txId,
        event.blockNumber,
        event.confirmations
      );

      await tx.signAndSend(relayerAccount, ({ status, events }) => {
        if (status.isInBlock) {
          logger.info('Token deposit submitted to ËTRID', {
            token: event.tokenSymbol,
            txId: event.txId,
            blockHash: status.asInBlock.toString(),
          });
        }
      });

    } catch (error) {
      logger.error('Error processing TRC-20 deposit', { event, error });
    }
  });

  // Handle USDT deposits (fast-track)
  monitor.on('usdtDeposit', async (event: Trc20DepositEvent) => {
    try {
      logger.info('Processing USDT deposit (FAST-TRACK)', {
        txId: event.txId,
        amountUSDT: (Number(event.amount) / 1_000_000).toFixed(6),
      });

      // Convert addresses
      const tronAddressBytes = monitor.getAddressBytes(event.tronAddress);

      // Use fast-track USDT deposit extrinsic
      const tx = api.tx.tronBridge.initiateUsdtDeposit(
        event.etridAccount,
        Array.from(tronAddressBytes),
        event.amount.toString(),
        event.txId,
        event.blockNumber,
        event.confirmations
      );

      await tx.signAndSend(relayerAccount, ({ status, events }) => {
        if (status.isInBlock) {
          logger.info('USDT deposit submitted to ËTRID (HIGH-PRIORITY)', {
            txId: event.txId,
            blockHash: status.asInBlock.toString(),
          });

          // Emit special event for monitoring
          events.forEach(({ event: { method, section, data } }) => {
            if (section === 'tronBridge' && method === 'UsdtDepositConfirmed') {
              logger.info('USDT deposit confirmed!', {
                data: data.toString(),
              });
            }
          });
        }
      });

    } catch (error) {
      logger.error('Error processing USDT deposit', { event, error });
    }
  });

  // Start monitor
  await monitor.start();

  logger.info('Full TRON bridge integration active');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await monitor.stop();
    await api.disconnect();
    process.exit(0);
  });
}

/**
 * Helper: Confirm TRX deposit after confirmations
 */
async function confirmTrxDeposit(
  api: ApiPromise,
  relayerAccount: any,
  txId: string
) {
  logger.info('Confirming TRX deposit', { txId });

  const tx = api.tx.tronBridge.confirmTrxDeposit(txId);

  await tx.signAndSend(relayerAccount, ({ status, events }) => {
    if (status.isInBlock) {
      logger.info('TRX deposit confirmed in ËTRID', {
        txId,
        blockHash: status.asInBlock.toString(),
      });

      // Check for DepositConfirmed event
      events.forEach(({ event: { method, section, data } }) => {
        if (section === 'tronBridge' && method === 'DepositConfirmed') {
          logger.info('DepositConfirmed event emitted!', {
            txId,
            data: data.toString(),
          });
        }
      });
    }
  });
}

/**
 * EXAMPLE 3: Testnet Setup (Shasta)
 */
async function example3_TestnetSetup() {
  logger.info('Example 3: Testnet Setup (Shasta)');

  // Create monitor for Shasta testnet
  const monitor = createTronMonitor(
    'TYourTestnetBridgeContract', // Testnet contract
    'shasta', // Shasta testnet
    {
      pollIntervalMs: 3000,
      minConfirmations: 19,
    }
  );

  monitor.on('trxDeposit', (event) => {
    logger.info('[TESTNET] TRX Deposit', {
      depositor: event.tronAddress,
      amount: event.amount.toString(),
      txId: event.txId,
    });
  });

  await monitor.start();

  logger.info('Shasta testnet monitor started');
}

/**
 * EXAMPLE 4: Advanced Error Handling and Recovery
 */
async function example4_ErrorHandling() {
  logger.info('Example 4: Advanced Error Handling');

  const monitor = createTronMonitor(
    process.env.TRON_BRIDGE_CONTRACT!,
    'mainnet',
    {
      tronGridApiKey: process.env.TRONGRID_API_KEY,
      pollIntervalMs: 3000,
      minConfirmations: 19,
    }
  );

  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  monitor.on('error', async (error) => {
    consecutiveErrors++;
    logger.error(`TRON Monitor error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, error);

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.error('Too many consecutive errors, restarting monitor...');

      try {
        await monitor.stop();
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
        await monitor.start();
        consecutiveErrors = 0;
        logger.info('TRON Monitor restarted successfully');
      } catch (restartError) {
        logger.error('Failed to restart monitor', restartError);
        process.exit(1);
      }
    }
  });

  monitor.on('trxDeposit', () => {
    // Reset error counter on successful processing
    consecutiveErrors = 0;
  });

  monitor.on('trc20Deposit', () => {
    consecutiveErrors = 0;
  });

  await monitor.start();

  // Health check endpoint
  setInterval(() => {
    const status = monitor.getStatus();
    logger.info('TRON Monitor Health Check', {
      isRunning: status.isRunning,
      lastBlock: status.lastBlock,
      depositsProcessed: status.depositsProcessed,
      errors: status.errors,
      lastError: status.lastError,
    });
  }, 60000); // Every minute
}

/**
 * EXAMPLE 5: Query Deposit by Transaction ID
 */
async function example5_QueryDeposit() {
  logger.info('Example 5: Query Deposit by TX ID');

  const monitor = createTronMonitor(
    process.env.TRON_BRIDGE_CONTRACT!,
    'mainnet',
    {
      tronGridApiKey: process.env.TRONGRID_API_KEY,
    }
  );

  await monitor.start();

  // Query specific deposit
  const txId = '0x1234567890abcdef...'; // Replace with actual TX ID
  const deposit = await monitor.getDepositByTxId(txId);

  if (deposit) {
    logger.info('Deposit found!', {
      txId,
      event: deposit.event_name,
      blockNumber: deposit.block_number,
      result: deposit.result,
    });
  } else {
    logger.info('Deposit not found', { txId });
  }
}

/**
 * EXAMPLE 6: Address Conversion Utilities
 */
async function example6_AddressUtils() {
  logger.info('Example 6: Address Conversion Utilities');

  const monitor = createTronMonitor('TDummyContract', 'mainnet');
  await monitor.start();

  // TRON address examples
  const base58Address = 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3';

  // Convert to hex (41-prefixed)
  const hexAddress = monitor.addressToHex(base58Address);
  logger.info('Base58 to Hex', { base58Address, hexAddress });

  // Convert back to base58
  const base58Back = monitor.addressFromHex(hexAddress);
  logger.info('Hex to Base58', { hexAddress, base58Back });

  // Get 21-byte address
  const addressBytes = monitor.getAddressBytes(base58Address);
  logger.info('Address bytes (21 bytes)', {
    length: addressBytes.length,
    hex: Buffer.from(addressBytes).toString('hex'),
  });

  // Validate address
  const isValid = monitor.isValidAddress(base58Address);
  logger.info('Address validation', { base58Address, isValid });

  const invalidAddress = 'InvalidAddress123';
  const isInvalid = monitor.isValidAddress(invalidAddress);
  logger.info('Invalid address check', { invalidAddress, isValid: isInvalid });
}

/**
 * Run examples
 */
async function main() {
  const exampleNumber = process.argv[2] || '1';

  switch (exampleNumber) {
    case '1':
      await example1_BasicSetup();
      break;
    case '2':
      await example2_FullIntegration();
      break;
    case '3':
      await example3_TestnetSetup();
      break;
    case '4':
      await example4_ErrorHandling();
      break;
    case '5':
      await example5_QueryDeposit();
      break;
    case '6':
      await example6_AddressUtils();
      break;
    default:
      logger.info('Usage: ts-node TronMonitor.example.ts [1-6]');
      logger.info('Examples:');
      logger.info('  1 - Basic Setup');
      logger.info('  2 - Full Integration');
      logger.info('  3 - Testnet Setup');
      logger.info('  4 - Error Handling');
      logger.info('  5 - Query Deposit');
      logger.info('  6 - Address Utils');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Example failed', error);
    process.exit(1);
  });
}

export {
  example1_BasicSetup,
  example2_FullIntegration,
  example3_TestnetSetup,
  example4_ErrorHandling,
  example5_QueryDeposit,
  example6_AddressUtils,
};
