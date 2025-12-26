/**
 * Attestation Submitter
 *
 * Submits attestations to PBC chains via the pallet-bridge-attestation pallet.
 * Handles WebSocket connections, extrinsic submission, and tracks submission status.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { logger } from '../utils/logger';
import {
  SubmitAttestationParams,
  AttestationSubmissionResult,
  AttestationSubmitterConfig,
  PbcChainConfig,
  AttestationStatus,
  SubmissionOptions,
  ExtendedSubmissionResult,
  TxStatus,
  AttesterSignature,
} from './types';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  defaultRetries: 3,
  retryDelayMs: 2000,
  timeout: 60000, // 60 seconds
};

/**
 * Attestation Submitter for PBC chains
 */
export class AttestationSubmitter {
  private config: Required<AttestationSubmitterConfig>;
  private apiConnections: Map<string, ApiPromise> = new Map();
  private connectionPromises: Map<string, Promise<ApiPromise>> = new Map();

  // Metrics
  private totalSubmissions = 0;
  private successfulSubmissions = 0;
  private failedSubmissions = 0;

  constructor(config: AttestationSubmitterConfig) {
    this.config = {
      ...config,
      defaultRetries: config.defaultRetries ?? DEFAULT_CONFIG.defaultRetries,
      retryDelayMs: config.retryDelayMs ?? DEFAULT_CONFIG.retryDelayMs,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
    };
  }

  /**
   * Connect to a PBC chain
   */
  private async connectToPbc(chainName: string): Promise<ApiPromise> {
    // Return existing connection if available
    if (this.apiConnections.has(chainName)) {
      return this.apiConnections.get(chainName)!;
    }

    // Return in-progress connection promise if connecting
    if (this.connectionPromises.has(chainName)) {
      return this.connectionPromises.get(chainName)!;
    }

    const chainConfig = this.config.chains[chainName];
    if (!chainConfig) {
      throw new Error(`Chain configuration not found for: ${chainName}`);
    }

    if (!chainConfig.enabled) {
      throw new Error(`Chain is disabled: ${chainName}`);
    }

    logger.info('Connecting to PBC', {
      chain: chainName,
      endpoint: chainConfig.wsEndpoint,
    });

    // Create connection promise
    const connectionPromise = (async () => {
      try {
        const provider = new WsProvider(chainConfig.wsEndpoint, false);
        const api = await ApiPromise.create({ provider });

        // Get chain info
        const [chain, nodeName, nodeVersion] = await Promise.all([
          api.rpc.system.chain(),
          api.rpc.system.name(),
          api.rpc.system.version(),
        ]);

        logger.info('Connected to PBC', {
          chain: chainName,
          chainInfo: chain.toString(),
          nodeName: nodeName.toString(),
          nodeVersion: nodeVersion.toString(),
        });

        this.apiConnections.set(chainName, api);
        this.connectionPromises.delete(chainName);

        return api;
      } catch (error: any) {
        this.connectionPromises.delete(chainName);
        logger.error('Failed to connect to PBC', {
          chain: chainName,
          error: error?.message || String(error),
        });
        throw error;
      }
    })();

    this.connectionPromises.set(chainName, connectionPromise);
    return connectionPromise;
  }

  /**
   * Disconnect from a PBC chain
   */
  private async disconnectFromPbc(chainName: string): Promise<void> {
    const api = this.apiConnections.get(chainName);
    if (api) {
      await api.disconnect();
      this.apiConnections.delete(chainName);
      logger.info('Disconnected from PBC', { chain: chainName });
    }
  }

  /**
   * Disconnect from all PBC chains
   */
  async disconnectAll(): Promise<void> {
    logger.info('Disconnecting from all PBCs');

    const disconnectPromises = Array.from(this.apiConnections.keys()).map(
      (chainName) => this.disconnectFromPbc(chainName)
    );

    await Promise.all(disconnectPromises);
    logger.info('Disconnected from all PBCs');
  }

  /**
   * Submit attestation to PBC
   */
  async submitAttestation(
    params: SubmitAttestationParams,
    options?: SubmissionOptions
  ): Promise<AttestationSubmissionResult> {
    const { pbcEndpoint, messageHash, signatures, signerKeypair, message } = params;

    // Find chain name from endpoint
    const chainName = this.findChainNameByEndpoint(pbcEndpoint);
    if (!chainName) {
      throw new Error(`No chain configuration found for endpoint: ${pbcEndpoint}`);
    }

    logger.info('Submitting attestation to PBC', {
      chain: chainName,
      messageHash,
      signatureCount: signatures.length,
    });

    this.totalSubmissions++;

    try {
      // Connect to PBC
      const api = await this.connectToPbc(chainName);

      // Check if pallet exists
      if (!api.tx.bridgeAttestation) {
        throw new Error(`pallet-bridge-attestation not found on chain: ${chainName}`);
      }

      // Prepare signature data for the pallet
      const signatureVecs = signatures.map(sig => {
        const sigBytes = sig.signature.startsWith('0x')
          ? sig.signature.slice(2)
          : sig.signature;
        return Array.from(hexToU8a('0x' + sigBytes));
      });

      const attesterAccounts = signatures.map(sig => sig.attester);

      // Create extrinsic: bridgeAttestation.submitAttestation(message_hash, signatures, attesters)
      const extrinsic = api.tx.bridgeAttestation.submitAttestation(
        messageHash,
        signatureVecs,
        attesterAccounts
      );

      logger.debug('Created attestation extrinsic', {
        chain: chainName,
        messageHash,
        method: extrinsic.method.toHuman(),
      });

      // Submit with retry logic
      const result = await this.submitExtrinsicWithRetry(
        api,
        extrinsic,
        signerKeypair,
        chainName,
        options
      );

      if (result.success) {
        this.successfulSubmissions++;
        logger.info('Attestation submitted successfully', {
          chain: chainName,
          messageHash,
          txHash: result.txHash,
        });
      } else {
        this.failedSubmissions++;
        logger.error('Attestation submission failed', {
          chain: chainName,
          messageHash,
          error: result.error,
        });
      }

      return result;
    } catch (error: any) {
      this.failedSubmissions++;

      const errorResult: AttestationSubmissionResult = {
        success: false,
        error: error?.message || String(error),
        chainName,
        timestamp: Date.now(),
      };

      logger.error('Failed to submit attestation', {
        chain: chainName,
        messageHash,
        error: errorResult.error,
      });

      return errorResult;
    }
  }

  /**
   * Submit extrinsic with retry logic
   */
  private async submitExtrinsicWithRetry(
    api: ApiPromise,
    extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult>,
    signer: KeyringPair,
    chainName: string,
    options?: SubmissionOptions,
    retryCount = 0
  ): Promise<AttestationSubmissionResult> {
    const maxRetries = options?.maxRetries ?? this.config.defaultRetries;
    const retryDelay = options?.retryDelay ?? this.config.retryDelayMs;
    const waitForFinalization = options?.waitForFinalization ?? true;

    try {
      const result = await new Promise<AttestationSubmissionResult>((resolve, reject) => {
        let txHash: string | undefined;
        let blockHash: string | undefined;
        let blockNumber: number | undefined;

        const submissionOptions: any = {};
        if (options?.nonce !== undefined) {
          submissionOptions.nonce = options.nonce;
        }
        if (options?.tip !== undefined) {
          submissionOptions.tip = options.tip;
        }

        extrinsic
          .signAndSend(signer, submissionOptions, ({ status, dispatchError, events, txHash: hash }) => {
            txHash = hash.toString();

            if (status.isInBlock) {
              blockHash = status.asInBlock.toString();

              logger.debug('Attestation in block', {
                chain: chainName,
                txHash,
                blockHash,
              });

              // If not waiting for finalization, resolve here
              if (!waitForFinalization && !dispatchError) {
                resolve({
                  success: true,
                  txHash,
                  blockHash,
                  chainName,
                  timestamp: Date.now(),
                });
              }
            }

            if (status.isFinalized) {
              blockHash = status.asFinalized.toString();

              logger.info('Attestation finalized', {
                chain: chainName,
                txHash,
                blockHash,
              });

              // Check for dispatch errors
              if (dispatchError) {
                let errorInfo = '';

                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                } else {
                  errorInfo = dispatchError.toString();
                }

                logger.error('Attestation dispatch error', {
                  chain: chainName,
                  txHash,
                  error: errorInfo,
                });

                reject(new Error(errorInfo));
              } else {
                // Extract block number from events
                const blockNumberFromEvents = events
                  .filter(({ event }) => api.events.system.ExtrinsicSuccess.is(event))
                  .map(({ phase }) => {
                    if (phase.isApplyExtrinsic) {
                      return phase.asApplyExtrinsic.toNumber();
                    }
                    return undefined;
                  })
                  .find((num) => num !== undefined);

                resolve({
                  success: true,
                  txHash,
                  blockHash,
                  blockNumber: blockNumberFromEvents,
                  chainName,
                  timestamp: Date.now(),
                });
              }
            }

            if (status.isInvalid || status.isDropped || status.isFinalityTimeout) {
              const error = `Transaction ${status.type}`;
              logger.error('Attestation submission failed', {
                chain: chainName,
                txHash,
                status: status.type,
              });
              reject(new Error(error));
            }
          })
          .catch((error) => {
            logger.error('Failed to sign and send extrinsic', {
              chain: chainName,
              error: error?.message,
            });
            reject(error);
          });
      });

      return result;
    } catch (error: any) {
      // Retry logic
      if (retryCount < maxRetries) {
        logger.warn('Retrying attestation submission', {
          chain: chainName,
          retryCount: retryCount + 1,
          maxRetries,
          delayMs: retryDelay,
          error: error?.message,
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        // Exponential backoff
        const nextRetryDelay = retryDelay * 1.5;
        const nextOptions = { ...options, retryDelay: nextRetryDelay };

        return this.submitExtrinsicWithRetry(
          api,
          extrinsic,
          signer,
          chainName,
          nextOptions,
          retryCount + 1
        );
      }

      // Max retries exceeded
      return {
        success: false,
        error: error?.message || String(error),
        chainName,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check attestation status on PBC
   */
  async getAttestationStatus(
    pbcEndpoint: string,
    messageHash: string
  ): Promise<AttestationStatus | null> {
    const chainName = this.findChainNameByEndpoint(pbcEndpoint);
    if (!chainName) {
      throw new Error(`No chain configuration found for endpoint: ${pbcEndpoint}`);
    }

    try {
      const api = await this.connectToPbc(chainName);

      if (!api.query.bridgeAttestation) {
        logger.warn('pallet-bridge-attestation not found', { chain: chainName });
        return null;
      }

      // Query attestation status
      const attestations = await api.query.bridgeAttestation.messageAttestations(messageHash);
      const isVerified = await api.query.bridgeAttestation.verifiedMessages(messageHash);
      const threshold = await api.query.bridgeAttestation.attestationThreshold();

      const attestationsJson: any = attestations.toJSON();
      const attestationsList = Array.isArray(attestationsJson) ? attestationsJson : [];

      return {
        messageHash,
        isVerified: isVerified.toJSON() === true,
        attestations: attestationsList.length,
        requiredAttestations: threshold.toJSON() as number,
        attesters: attestationsList.map((a: any) => a.attester || a),
        submittedAt: undefined, // Would need additional storage query
      };
    } catch (error: any) {
      logger.error('Failed to get attestation status', {
        chain: chainName,
        messageHash,
        error: error?.message,
      });
      return null;
    }
  }

  /**
   * Find chain name by WebSocket endpoint
   */
  private findChainNameByEndpoint(endpoint: string): string | null {
    for (const [name, config] of Object.entries(this.config.chains)) {
      if (config.wsEndpoint === endpoint) {
        return name;
      }
    }
    return null;
  }

  /**
   * Get submission statistics
   */
  getStats() {
    return {
      totalSubmissions: this.totalSubmissions,
      successfulSubmissions: this.successfulSubmissions,
      failedSubmissions: this.failedSubmissions,
      successRate:
        this.totalSubmissions > 0
          ? (this.successfulSubmissions / this.totalSubmissions) * 100
          : 0,
      connectedChains: Array.from(this.apiConnections.keys()),
    };
  }

  /**
   * Check if connected to a specific chain
   */
  isConnected(chainName: string): boolean {
    return this.apiConnections.has(chainName);
  }

  /**
   * Get list of all configured chains
   */
  getConfiguredChains(): string[] {
    return Object.keys(this.config.chains).filter(
      (name) => this.config.chains[name].enabled
    );
  }
}
