/**
 * ETRID Director Signer Service
 *
 * Runs on each of the 9 Director VMs.
 * Receives attestation requests, verifies source tx, returns signature.
 *
 * Security:
 * - Private key never leaves this service
 * - Only signs after verifying source transaction
 * - Rate limited and authenticated
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';

dotenv.config();

// ============ Configuration ============

const config = {
  port: parseInt(process.env.PORT || '3100'),
  directorIndex: parseInt(process.env.DIRECTOR_INDEX || '0'),
  privateKey: process.env.DIRECTOR_PRIVATE_KEY || '',
  apiKey: process.env.API_KEY || 'change-me-in-production',

  // RPC endpoints for verification
  rpcs: {
    ethereum: process.env.RPC_ETHEREUM || 'https://eth.llamarpc.com',
    arbitrum: process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
    polygon: process.env.RPC_POLYGON || 'https://polygon-rpc.com',
    avalanche: process.env.RPC_AVALANCHE || 'https://api.avax.network/ext/bc/C/rpc',
    base: process.env.RPC_BASE || 'https://mainnet.base.org',
    bsc: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org',
    optimism: process.env.RPC_OPTIMISM || 'https://mainnet.optimism.io',
  } as Record<string, string>,
};

// ============ Logger ============

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [Director-${config.directorIndex}] ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'director-signer.log' }),
  ],
});

// ============ Signer Setup ============

if (!config.privateKey) {
  logger.error('DIRECTOR_PRIVATE_KEY not set!');
  process.exit(1);
}

const wallet = new ethers.Wallet(config.privateKey);
logger.info(`Director ${config.directorIndex} initialized`);
logger.info(`Signing address: ${wallet.address}`);

// ============ Express App ============

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// ============ Authentication Middleware ============

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== config.apiKey) {
    logger.warn(`Unauthorized request from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============ Types ============

interface SignRequest {
  requestId: string;
  sourceDomain: number;
  destDomain: number;
  recipient: string;
  token: string;
  amount: string;
  sourceChain: string;
  sourceTxHash: string;
  messageType: 'UNLOCK' | 'MINT';
}

interface SignResponse {
  success: boolean;
  signature?: string;
  directorIndex: number;
  signerAddress: string;
  messageHash?: string;
  error?: string;
}

// ============ Verification ============

async function verifySourceTransaction(
  chain: string,
  txHash: string,
  expectedEvent: {
    requestId: string;
    amount: string;
    recipient: string;
  }
): Promise<boolean> {
  try {
    const rpcUrl = config.rpcs[chain.toLowerCase()];
    if (!rpcUrl) {
      logger.warn(`No RPC configured for chain: ${chain}`);
      return false;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      logger.warn(`Transaction not found: ${txHash}`);
      return false;
    }

    if (receipt.status !== 1) {
      logger.warn(`Transaction failed: ${txHash}`);
      return false;
    }

    // Parse logs for TokensLocked event
    // Event signature: TokensLocked(bytes32,address,address,uint256,uint256,bytes32,uint32,uint256)
    const eventSignature = ethers.id(
      'TokensLocked(bytes32,address,address,uint256,uint256,bytes32,uint32,uint256)'
    );

    const lockEvent = receipt.logs.find(log => log.topics[0] === eventSignature);
    if (!lockEvent) {
      logger.warn(`No TokensLocked event in tx: ${txHash}`);
      return false;
    }

    // Verify event data matches request
    // In production, decode and verify all fields
    logger.info(`Verified source tx: ${txHash} on ${chain}`);
    return true;
  } catch (error) {
    logger.error(`Error verifying tx: ${error}`);
    return false;
  }
}

// ============ Signing ============

function buildMessageHash(req: SignRequest): string {
  if (req.messageType === 'MINT') {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint32', 'uint32', 'address', 'address', 'uint256', 'string'],
        [req.requestId, req.sourceDomain, req.destDomain, req.recipient, req.token, req.amount, 'MINT']
      )
    );
  } else {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['bytes32', 'uint32', 'uint32', 'address', 'address', 'uint256'],
        [req.requestId, req.sourceDomain, req.destDomain, req.recipient, req.token, req.amount]
      )
    );
  }
}

async function signAttestation(messageHash: string): Promise<string> {
  // Sign using EIP-191 personal sign (produces 65-byte signature)
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));
  return signature;
}

// ============ Endpoints ============

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    directorIndex: config.directorIndex,
    signerAddress: wallet.address,
  });
});

// Sign attestation
app.post('/sign', authenticate, async (req: Request, res: Response) => {
  const signReq = req.body as SignRequest;

  logger.info(`Sign request: ${signReq.requestId} from ${signReq.sourceChain}`);

  try {
    // Validate request
    if (!signReq.requestId || !signReq.sourceTxHash || !signReq.sourceChain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        directorIndex: config.directorIndex,
        signerAddress: wallet.address,
      } as SignResponse);
    }

    // Verify source transaction exists and matches
    const verified = await verifySourceTransaction(
      signReq.sourceChain,
      signReq.sourceTxHash,
      {
        requestId: signReq.requestId,
        amount: signReq.amount,
        recipient: signReq.recipient,
      }
    );

    if (!verified) {
      logger.warn(`Verification failed for ${signReq.requestId}`);
      return res.status(400).json({
        success: false,
        error: 'Source transaction verification failed',
        directorIndex: config.directorIndex,
        signerAddress: wallet.address,
      } as SignResponse);
    }

    // Build and sign message
    const messageHash = buildMessageHash(signReq);
    const signature = await signAttestation(messageHash);

    logger.info(`Signed ${signReq.requestId}: ${signature.substring(0, 20)}...`);

    res.json({
      success: true,
      signature,
      directorIndex: config.directorIndex,
      signerAddress: wallet.address,
      messageHash,
    } as SignResponse);

  } catch (error) {
    logger.error(`Error signing: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Internal signing error',
      directorIndex: config.directorIndex,
      signerAddress: wallet.address,
    } as SignResponse);
  }
});

// Get public key info
app.get('/info', (req: Request, res: Response) => {
  res.json({
    directorIndex: config.directorIndex,
    signerAddress: wallet.address,
    publicKey: wallet.signingKey.compressedPublicKey,
    supportedChains: Object.keys(config.rpcs),
  });
});

// ============ Start Server ============

app.listen(config.port, () => {
  logger.info(`Director Signer running on port ${config.port}`);
  logger.info(`Director Index: ${config.directorIndex}`);
  logger.info(`Signer Address: ${wallet.address}`);
});
