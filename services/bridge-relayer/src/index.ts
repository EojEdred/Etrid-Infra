/**
 * ETRID Bridge Relayer Service
 *
 * Main orchestration service for cross-chain bridges:
 * 1. Watches all chains for lock/burn events
 * 2. Collects signatures from 9 Directors (needs 5)
 * 3. Submits attestation to destination chain
 *
 * Can run multiple instances for redundancy.
 */

import { ethers } from 'ethers';
import axios from 'axios';
import Database from 'better-sqlite3';
import * as dotenv from 'dotenv';
import { createLogger, format, transports } from 'winston';

dotenv.config();

// ============ Configuration ============

interface ChainConfig {
  name: string;
  domainId: number;
  rpc: string;
  bridgeAddress: string;
  chainId?: number;
}

interface DirectorConfig {
  index: number;
  url: string;
  publicKey: string;
}

const config = {
  // Database
  dbPath: process.env.DB_PATH || './relayer.db',

  // Relayer wallet (for submitting txs)
  privateKey: process.env.RELAYER_PRIVATE_KEY || '',

  // API key for Director communication
  apiKey: process.env.DIRECTOR_API_KEY || 'change-me-in-production',

  // Polling interval (ms)
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000'),

  // Signature threshold
  threshold: 5,

  // Chains to watch
  chains: {
    ethereum: {
      name: 'Ethereum',
      domainId: 100,
      chainId: 1,
      rpc: process.env.RPC_ETHEREUM || 'https://eth.llamarpc.com',
      bridgeAddress: process.env.BRIDGE_ETHEREUM || '',
    },
    arbitrum: {
      name: 'Arbitrum',
      domainId: 101,
      chainId: 42161,
      rpc: process.env.RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc',
      bridgeAddress: process.env.BRIDGE_ARBITRUM || '',
    },
    polygon: {
      name: 'Polygon',
      domainId: 102,
      chainId: 137,
      rpc: process.env.RPC_POLYGON || 'https://polygon-rpc.com',
      bridgeAddress: process.env.BRIDGE_POLYGON || '',
    },
    base: {
      name: 'Base',
      domainId: 104,
      chainId: 8453,
      rpc: process.env.RPC_BASE || 'https://mainnet.base.org',
      bridgeAddress: process.env.BRIDGE_BASE || '',
    },
    bsc: {
      name: 'BSC',
      domainId: 105,
      chainId: 56,
      rpc: process.env.RPC_BSC || 'https://bsc-dataseed.binance.org',
      bridgeAddress: process.env.BRIDGE_BSC || '',
    },
  } as Record<string, ChainConfig>,

  // 9 Directors
  directors: [
    { index: 0, url: process.env.DIRECTOR_1_URL || 'http://localhost:3101', publicKey: '' },
    { index: 1, url: process.env.DIRECTOR_2_URL || 'http://localhost:3102', publicKey: '' },
    { index: 2, url: process.env.DIRECTOR_3_URL || 'http://localhost:3103', publicKey: '' },
    { index: 3, url: process.env.DIRECTOR_4_URL || 'http://localhost:3104', publicKey: '' },
    { index: 4, url: process.env.DIRECTOR_5_URL || 'http://localhost:3105', publicKey: '' },
    { index: 5, url: process.env.DIRECTOR_6_URL || 'http://localhost:3106', publicKey: '' },
    { index: 6, url: process.env.DIRECTOR_7_URL || 'http://localhost:3107', publicKey: '' },
    { index: 7, url: process.env.DIRECTOR_8_URL || 'http://localhost:3108', publicKey: '' },
    { index: 8, url: process.env.DIRECTOR_9_URL || 'http://localhost:3109', publicKey: '' },
  ] as DirectorConfig[],
};

// ============ Logger ============

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [Relayer] ${level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'relayer.log' }),
  ],
});

// ============ Database ============

const db = new Database(config.dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bridge_requests (
    request_id TEXT PRIMARY KEY,
    source_chain TEXT NOT NULL,
    source_domain INTEGER NOT NULL,
    dest_domain INTEGER NOT NULL,
    source_tx_hash TEXT NOT NULL,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    token TEXT NOT NULL,
    amount TEXT NOT NULL,
    message_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    signatures TEXT DEFAULT '[]',
    signature_count INTEGER DEFAULT 0,
    dest_tx_hash TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_status ON bridge_requests(status);
  CREATE INDEX IF NOT EXISTS idx_source_chain ON bridge_requests(source_chain);
`);

// ============ Types ============

interface BridgeRequest {
  request_id: string;
  source_chain: string;
  source_domain: number;
  dest_domain: number;
  source_tx_hash: string;
  sender: string;
  recipient: string;
  token: string;
  amount: string;
  message_type: 'UNLOCK' | 'MINT';
  status: 'pending' | 'collecting' | 'ready' | 'submitted' | 'confirmed' | 'failed';
  signatures: string;
  signature_count: number;
  dest_tx_hash: string | null;
}

interface LockEvent {
  requestId: string;
  sender: string;
  token: string;
  amount: bigint;
  fee: bigint;
  destinationAddress: string;
  destinationDomain: number;
  nonce: bigint;
  txHash: string;
  blockNumber: number;
}

// ============ Event Watching ============

const BRIDGE_ABI = [
  'event TokensLocked(bytes32 indexed requestId, address indexed sender, address token, uint256 amount, uint256 fee, bytes32 destinationAddress, uint32 destinationDomain, uint256 nonce)',
  'function unlockTokens(bytes32 requestId, uint32 sourceDomain, address recipient, address token, uint256 amount, bytes[] signatures)',
  'function mintTokens(bytes32 requestId, uint32 sourceDomain, address recipient, address wrappedToken, uint256 amount, bytes[] signatures)',
];

async function watchChain(chainName: string, chainConfig: ChainConfig) {
  if (!chainConfig.bridgeAddress) {
    logger.warn(`No bridge address for ${chainName}, skipping`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
  const bridge = new ethers.Contract(chainConfig.bridgeAddress, BRIDGE_ABI, provider);

  logger.info(`Watching ${chainName} for TokensLocked events`);

  // Get last processed block from DB or start from recent
  let lastBlock = await provider.getBlockNumber() - 100;

  const poll = async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      const events = await bridge.queryFilter(
        bridge.filters.TokensLocked(),
        lastBlock + 1,
        currentBlock
      );

      for (const event of events) {
        const parsed = event as ethers.EventLog;
        const lockEvent: LockEvent = {
          requestId: parsed.args[0],
          sender: parsed.args[1],
          token: parsed.args[2],
          amount: parsed.args[3],
          fee: parsed.args[4],
          destinationAddress: parsed.args[5],
          destinationDomain: parsed.args[6],
          nonce: parsed.args[7],
          txHash: parsed.transactionHash,
          blockNumber: parsed.blockNumber,
        };

        await handleLockEvent(chainName, chainConfig, lockEvent);
      }

      lastBlock = currentBlock;
    } catch (error) {
      logger.error(`Error polling ${chainName}: ${error}`);
    }
  };

  // Poll periodically
  setInterval(poll, config.pollInterval);
  poll(); // Initial poll
}

async function handleLockEvent(chainName: string, chainConfig: ChainConfig, event: LockEvent) {
  logger.info(`Lock event on ${chainName}: ${event.requestId}`);

  // Check if already processed
  const existing = db.prepare('SELECT * FROM bridge_requests WHERE request_id = ?').get(event.requestId);
  if (existing) {
    logger.info(`Request ${event.requestId} already exists, skipping`);
    return;
  }

  // Decode destination address (bytes32 to address)
  const recipient = '0x' + event.destinationAddress.slice(-40);

  // Insert new request
  db.prepare(`
    INSERT INTO bridge_requests (
      request_id, source_chain, source_domain, dest_domain,
      source_tx_hash, sender, recipient, token, amount, message_type, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.requestId,
    chainName,
    chainConfig.domainId,
    event.destinationDomain,
    event.txHash,
    event.sender,
    recipient,
    event.token,
    event.amount.toString(),
    'UNLOCK', // or MINT depending on token type
    'pending'
  );

  logger.info(`Stored request ${event.requestId}`);
}

// ============ Signature Collection ============

async function collectSignatures() {
  // Get pending requests that need signatures
  const pendingRequests = db.prepare(`
    SELECT * FROM bridge_requests
    WHERE status IN ('pending', 'collecting') AND signature_count < ?
  `).all(config.threshold) as BridgeRequest[];

  for (const request of pendingRequests) {
    await collectSignaturesForRequest(request);
  }
}

async function collectSignaturesForRequest(request: BridgeRequest) {
  logger.info(`Collecting signatures for ${request.request_id}`);

  // Update status
  db.prepare('UPDATE bridge_requests SET status = ? WHERE request_id = ?')
    .run('collecting', request.request_id);

  const existingSignatures: { index: number; signature: string }[] = JSON.parse(request.signatures);
  const collectedIndices = new Set(existingSignatures.map(s => s.index));

  // Request signatures from Directors we haven't collected from
  const signaturePromises = config.directors
    .filter(d => !collectedIndices.has(d.index))
    .map(async (director) => {
      try {
        const response = await axios.post(
          `${director.url}/sign`,
          {
            requestId: request.request_id,
            sourceDomain: request.source_domain,
            destDomain: request.dest_domain,
            recipient: request.recipient,
            token: request.token,
            amount: request.amount,
            sourceChain: request.source_chain,
            sourceTxHash: request.source_tx_hash,
            messageType: request.message_type,
          },
          {
            headers: { 'X-API-Key': config.apiKey },
            timeout: 10000,
          }
        );

        if (response.data.success) {
          return {
            index: director.index,
            signature: response.data.signature,
          };
        }
      } catch (error) {
        logger.warn(`Failed to get signature from Director ${director.index}: ${error}`);
      }
      return null;
    });

  const results = await Promise.all(signaturePromises);
  const newSignatures = results.filter(r => r !== null) as { index: number; signature: string }[];

  // Merge with existing
  const allSignatures = [...existingSignatures, ...newSignatures];
  const uniqueSignatures = Array.from(
    new Map(allSignatures.map(s => [s.index, s])).values()
  );

  // Update database
  const newStatus = uniqueSignatures.length >= config.threshold ? 'ready' : 'collecting';
  db.prepare(`
    UPDATE bridge_requests
    SET signatures = ?, signature_count = ?, status = ?, updated_at = strftime('%s', 'now')
    WHERE request_id = ?
  `).run(
    JSON.stringify(uniqueSignatures),
    uniqueSignatures.length,
    newStatus,
    request.request_id
  );

  logger.info(`Request ${request.request_id}: ${uniqueSignatures.length}/${config.threshold} signatures`);
}

// ============ Submission ============

async function submitAttestations() {
  if (!config.privateKey) {
    logger.warn('No relayer private key configured, cannot submit');
    return;
  }

  // Get requests ready for submission
  const readyRequests = db.prepare(`
    SELECT * FROM bridge_requests WHERE status = 'ready'
  `).all() as BridgeRequest[];

  for (const request of readyRequests) {
    await submitAttestation(request);
  }
}

async function submitAttestation(request: BridgeRequest) {
  logger.info(`Submitting attestation for ${request.request_id}`);

  try {
    // Find destination chain config
    const destChain = Object.values(config.chains).find(
      c => c.domainId === request.dest_domain
    );

    if (!destChain || !destChain.bridgeAddress) {
      logger.error(`No destination chain config for domain ${request.dest_domain}`);
      return;
    }

    const provider = new ethers.JsonRpcProvider(destChain.rpc);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const bridge = new ethers.Contract(destChain.bridgeAddress, BRIDGE_ABI, wallet);

    // Parse signatures
    const signatures: { index: number; signature: string }[] = JSON.parse(request.signatures);
    const sigArray = signatures
      .sort((a, b) => a.index - b.index)
      .slice(0, config.threshold)
      .map(s => s.signature);

    // Submit based on message type
    let tx: ethers.TransactionResponse;
    if (request.message_type === 'MINT') {
      tx = await bridge.mintTokens(
        request.request_id,
        request.source_domain,
        request.recipient,
        request.token,
        request.amount,
        sigArray
      );
    } else {
      tx = await bridge.unlockTokens(
        request.request_id,
        request.source_domain,
        request.recipient,
        request.token,
        request.amount,
        sigArray
      );
    }

    logger.info(`Submitted tx: ${tx.hash}`);

    // Update status
    db.prepare(`
      UPDATE bridge_requests
      SET status = 'submitted', dest_tx_hash = ?, updated_at = strftime('%s', 'now')
      WHERE request_id = ?
    `).run(tx.hash, request.request_id);

    // Wait for confirmation
    const receipt = await tx.wait();
    if (receipt && receipt.status === 1) {
      db.prepare(`
        UPDATE bridge_requests
        SET status = 'confirmed', updated_at = strftime('%s', 'now')
        WHERE request_id = ?
      `).run(request.request_id);
      logger.info(`Confirmed: ${request.request_id}`);
    } else {
      throw new Error('Transaction failed');
    }

  } catch (error) {
    logger.error(`Failed to submit ${request.request_id}: ${error}`);
    db.prepare(`
      UPDATE bridge_requests
      SET status = 'failed', updated_at = strftime('%s', 'now')
      WHERE request_id = ?
    `).run(request.request_id);
  }
}

// ============ Main Loop ============

async function main() {
  logger.info('Starting ETRID Bridge Relayer');

  // Start watching all configured chains
  for (const [chainName, chainConfig] of Object.entries(config.chains)) {
    watchChain(chainName, chainConfig);
  }

  // Periodically collect signatures and submit
  setInterval(async () => {
    await collectSignatures();
    await submitAttestations();
  }, config.pollInterval * 2);

  logger.info('Relayer running');
}

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  process.exit(1);
});
