/**
 * Example usage of SolanaMonitor for ËTRID Bridge
 *
 * This demonstrates how to integrate the SolanaMonitor with the bridge relayer system
 */

import { SolanaMonitor } from './SolanaMonitor';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { logger } from '../utils/logger';

/**
 * Example bridge relayer that listens to SolanaMonitor events
 * and submits extrinsics to ËTRID runtime
 */
async function startSolanaBridgeRelayer() {
  // 1. Connect to ËTRID Substrate node
  const wsProvider = new WsProvider(process.env.SUBSTRATE_WS_URL || 'ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  logger.info('Connected to ËTRID node', {
    chain: await api.rpc.system.chain(),
    version: await api.rpc.system.version(),
  });

  // 2. Setup relayer account
  const keyring = new Keyring({ type: 'sr25519' });
  const relayer = keyring.addFromUri(process.env.RELAYER_SEED || '//Alice');

  logger.info('Relayer account loaded', {
    address: relayer.address,
  });

  // 3. Initialize Solana monitor
  const solanaMonitor = new SolanaMonitor({
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    solanaWsUrl: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
    solanaBridgeProgramId: process.env.SOLANA_BRIDGE_PROGRAM_ID || 'BRGPidxhcsLVFBQ5zZqRHZ8bKRAHhAhiEDCfqELV8M7u',
    ethereumRpcUrl: '', // Not used for Solana
    ethereumChainId: 0,
    substrateWsUrl: wsProvider.endpoint,
    substrateChainId: 2,
    port: 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
    relayerPrivateKey: '',
    relayerAddress: relayer.address,
    confirmationsRequired: 31,
    minConfirmations: 31,
  });

  // 4. Listen for confirmed SOL deposits
  solanaMonitor.on('depositConfirmed', async (deposit) => {
    logger.info('Processing confirmed Solana deposit', {
      etridRecipient: deposit.etridRecipient,
      amount: deposit.amount,
      slot: deposit.slot,
      confirmations: deposit.confirmations,
      tokenMint: deposit.tokenMint || 'SOL',
    });

    try {
      // Convert hex recipient to AccountId
      const recipientAccountId = deposit.etridRecipient;

      // Convert amount string to u128
      const amount = BigInt(deposit.amount);

      // Signature is already in [H256, H256] format
      const [sig1, sig2] = deposit.signature;

      // Determine if this is a token deposit or SOL deposit
      if (deposit.tokenMint) {
        // SPL Token deposit
        logger.info('Submitting SPL token deposit to ËTRID', {
          tokenMint: deposit.tokenMint,
        });

        // Convert token mint to H256
        const tokenMintH256 = deposit.tokenMint; // Already in hex format

        const tx = api.tx.solanaBridge.initiateTokenDeposit(
          recipientAccountId,
          deposit.solPubkey,
          tokenMintH256,
          amount,
          [sig1, sig2],
          deposit.slot,
          deposit.confirmations
        );

        await submitExtrinsic(tx, relayer, 'initiate_token_deposit');
      } else {
        // Native SOL deposit
        logger.info('Submitting SOL deposit to ËTRID');

        const tx = api.tx.solanaBridge.initiateSolDeposit(
          recipientAccountId,
          deposit.solPubkey,
          amount,
          [sig1, sig2],
          deposit.slot,
          deposit.confirmations
        );

        await submitExtrinsic(tx, relayer, 'initiate_sol_deposit');
      }

      // After confirmations are sufficient, confirm the deposit
      if (deposit.confirmations >= 31) {
        logger.info('Confirming deposit with sufficient confirmations');

        const confirmTx = api.tx.solanaBridge.confirmSolDeposit([sig1, sig2]);
        await submitExtrinsic(confirmTx, relayer, 'confirm_sol_deposit');
      }
    } catch (error) {
      logger.error('Failed to process deposit', {
        error,
        deposit,
      });
    }
  });

  // 5. Listen for confirmed token burns (wrapped ETR on Solana -> native ETR on ËTRID)
  solanaMonitor.on('burnConfirmed', async (burn) => {
    logger.info('Processing confirmed Solana token burn', {
      etridRecipient: burn.etridRecipient,
      amount: burn.amount,
      tokenMint: burn.tokenMint,
      slot: burn.slot,
    });

    try {
      const recipientAccountId = burn.etridRecipient;
      const amount = BigInt(burn.amount);
      const [sig1, sig2] = burn.signature;

      // Process ETR burn from Solana (unlock native ETR on ËTRID)
      const tx = api.tx.solanaBridge.processEtrBurnFromSolana(
        recipientAccountId,
        amount,
        [sig1, sig2]
      );

      await submitExtrinsic(tx, relayer, 'process_etr_burn_from_solana');
    } catch (error) {
      logger.error('Failed to process burn', {
        error,
        burn,
      });
    }
  });

  // 6. Handle errors
  solanaMonitor.on('error', (error) => {
    logger.error('SolanaMonitor error', { error });
  });

  // 7. Handle monitor lifecycle
  solanaMonitor.on('started', () => {
    logger.info('SolanaMonitor started successfully');
  });

  solanaMonitor.on('stopped', () => {
    logger.warn('SolanaMonitor stopped');
  });

  solanaMonitor.on('failed', () => {
    logger.error('SolanaMonitor failed after max retries');
    process.exit(1);
  });

  // 8. Start monitoring
  await solanaMonitor.start();

  logger.info('Solana bridge relayer is now running', {
    currentSlot: await solanaMonitor.getCurrentSlot(),
    pendingDeposits: solanaMonitor.getPendingDepositsCount(),
  });

  // 9. Health check endpoint
  setInterval(() => {
    const status = solanaMonitor.getStatus();
    logger.debug('Monitor status', status);
  }, 60000); // Every minute

  // 10. Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    await solanaMonitor.stop();
    await api.disconnect();
    process.exit(0);
  });
}

/**
 * Submit extrinsic to ËTRID with proper error handling
 */
async function submitExtrinsic(tx: any, signer: any, extrinsicName: string) {
  return new Promise<void>((resolve, reject) => {
    tx.signAndSend(signer, ({ status, events, dispatchError }: any) => {
      if (status.isInBlock) {
        logger.info(`Extrinsic ${extrinsicName} in block`, {
          blockHash: status.asInBlock.toHex(),
        });
      }

      if (status.isFinalized) {
        logger.info(`Extrinsic ${extrinsicName} finalized`, {
          blockHash: status.asFinalized.toHex(),
        });

        // Check for errors
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = tx.registry.findMetaError(dispatchError.asModule);
            logger.error('Extrinsic failed', {
              extrinsicName,
              error: `${decoded.section}.${decoded.name}: ${decoded.docs}`,
            });
            reject(new Error(`${decoded.section}.${decoded.name}`));
          } else {
            logger.error('Extrinsic failed', {
              extrinsicName,
              error: dispatchError.toString(),
            });
            reject(new Error(dispatchError.toString()));
          }
        } else {
          resolve();
        }
      }
    }).catch((error: Error) => {
      logger.error('Failed to submit extrinsic', {
        extrinsicName,
        error,
      });
      reject(error);
    });
  });
}

/**
 * Example: Manual check of a specific Solana transaction
 */
async function checkSolanaTransaction(signature: string) {
  const monitor = new SolanaMonitor({
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    solanaBridgeProgramId: process.env.SOLANA_BRIDGE_PROGRAM_ID || 'BRGPidxhcsLVFBQ5zZqRHZ8bKRAHhAhiEDCfqELV8M7u',
    // ... minimal config for testing
  } as any);

  await monitor.start();

  // Manually check a specific transaction
  await monitor.checkTransaction(signature);

  await monitor.stop();
}

// Run the relayer
if (require.main === module) {
  startSolanaBridgeRelayer().catch((error) => {
    logger.error('Fatal error', { error });
    process.exit(1);
  });
}

export { startSolanaBridgeRelayer, checkSolanaTransaction };
