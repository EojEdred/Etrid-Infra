/**
 * ËTRID 5-of-9 Attestation Test Script
 *
 * Tests the attestation collection flow across all 9 Director attesters.
 * Verifies that we can collect at least 5 valid signatures.
 *
 * Usage:
 *   npx ts-node scripts/test-attestation.ts
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const ATTESTERS = [
  { id: 1, name: 'Director-1', endpoint: 'http://100.93.43.18:3003', active: true },
  { id: 2, name: 'Director-2', endpoint: 'http://100.71.127.127:3003', active: true },
  { id: 3, name: 'Director-3', endpoint: 'http://100.68.185.50:3003', active: true },
  { id: 4, name: 'Director-4', endpoint: 'http://100.70.73.10:3003', active: true },
  { id: 5, name: 'Director-5', endpoint: 'http://100.88.104.58:3003', active: true },
  { id: 6, name: 'Director-6', endpoint: 'http://100.117.43.53:3003', active: true },
  { id: 7, name: 'Director-7', endpoint: 'http://100.109.252.56:3003', active: true },
  { id: 8, name: 'Director-8', endpoint: 'http://100.80.84.82:3003', active: true },
  { id: 9, name: 'Director-9', endpoint: 'http://100.86.111.37:3003', active: false }, // Emergency
];

const REQUIRED_SIGNATURES = 5;
const TIMEOUT_MS = 30000;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

interface AttesterResponse {
  attesterId: number;
  attesterName: string;
  publicKey: string;
  address: string;
  messageHash: string;
  signature: string;
  signedAt: string;
}

interface HealthResponse {
  status: string;
  attesterId: number;
  attesterName: string;
  address: string;
  uptime: number;
  attestationsCount: number;
}

// Simple fetch wrapper with timeout
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs: number = TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error: any) {
    clearTimeout(timeout);
    throw error;
  }
}

// Check attester health
async function checkAttesterHealth(attester: typeof ATTESTERS[0]): Promise<HealthResponse | null> {
  try {
    const response = await fetchWithTimeout(`${attester.endpoint}/health`, {}, 10000);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Request signature from attester
async function requestSignature(
  attester: typeof ATTESTERS[0],
  messageHash: string
): Promise<AttesterResponse | null> {
  try {
    const response = await fetchWithTimeout(`${attester.endpoint}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageHash,
        sourceDomain: 1, // Ethereum
        destDomain: 100, // Primearc
        nonce: 1,
        amount: '1000000000000000000', // 1 ETR
        sender: '0x0000000000000000000000000000000000000001',
        recipient: '0x0000000000000000000000000000000000000002',
      }),
    });

    if (response.ok) {
      return await response.json();
    }

    const error = await response.text();
    log(colors.yellow, `    Response: ${error}`);
    return null;
  } catch (error: any) {
    log(colors.yellow, `    Error: ${error.message}`);
    return null;
  }
}

// Verify signature
function verifySignature(messageHash: string, signature: string, expectedAddress: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

async function main() {
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.blue, '   ËTRID 5-of-9 Attestation Test');
  log(colors.blue, '═══════════════════════════════════════════════════════════');
  log(colors.cyan, `Required signatures: ${REQUIRED_SIGNATURES} of ${ATTESTERS.length}`);
  log(colors.cyan, `Timeout per attester: ${TIMEOUT_MS}ms`);

  // Step 1: Check attester health
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.yellow, 'Step 1: Checking attester health...\n');

  const healthResults: Map<number, HealthResponse | null> = new Map();
  let onlineCount = 0;

  for (const attester of ATTESTERS) {
    process.stdout.write(`  ${attester.name} (${attester.endpoint}): `);

    if (!attester.active) {
      console.log(`${colors.dim}INACTIVE (emergency backup)${colors.reset}`);
      healthResults.set(attester.id, null);
      continue;
    }

    const health = await checkAttesterHealth(attester);
    if (health) {
      console.log(`${colors.green}ONLINE${colors.reset} (${health.address.slice(0, 10)}...)`);
      healthResults.set(attester.id, health);
      onlineCount++;
    } else {
      console.log(`${colors.red}OFFLINE${colors.reset}`);
      healthResults.set(attester.id, null);
    }
  }

  log(colors.cyan, `\nOnline attesters: ${onlineCount}/${ATTESTERS.filter(a => a.active).length}`);

  if (onlineCount < REQUIRED_SIGNATURES) {
    log(colors.red, `\nERROR: Not enough attesters online. Need at least ${REQUIRED_SIGNATURES}.`);
    process.exit(1);
  }

  // Step 2: Generate test message hash
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.yellow, 'Step 2: Generating test message hash...\n');

  // Create a deterministic test message
  const testMessage = {
    sourceDomain: 1,
    destDomain: 100,
    nonce: Date.now(),
    sender: '0x0000000000000000000000000000000000000001',
    recipient: '0x0000000000000000000000000000000000000002',
    amount: '1000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Create message hash (keccak256 of encoded message)
  const encodedMessage = ethers.solidityPacked(
    ['uint32', 'uint32', 'uint64', 'address', 'address', 'uint256', 'uint256'],
    [
      testMessage.sourceDomain,
      testMessage.destDomain,
      testMessage.nonce,
      testMessage.sender,
      testMessage.recipient,
      testMessage.amount,
      testMessage.timestamp,
    ]
  );
  const messageHash = ethers.keccak256(encodedMessage);

  log(colors.cyan, `Message: ${JSON.stringify(testMessage, null, 2)}`);
  log(colors.cyan, `Message Hash: ${messageHash}`);

  // Step 3: Collect signatures
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.yellow, 'Step 3: Collecting signatures from attesters...\n');

  const signatures: AttesterResponse[] = [];
  const failedAttesters: string[] = [];

  for (const attester of ATTESTERS) {
    if (!attester.active) continue;
    if (!healthResults.get(attester.id)) {
      log(colors.dim, `  Skipping ${attester.name} (offline)`);
      continue;
    }

    process.stdout.write(`  ${attester.name}: `);

    const response = await requestSignature(attester, messageHash);
    if (response) {
      // Verify signature
      const isValid = verifySignature(messageHash, response.signature, response.address);
      if (isValid) {
        console.log(`${colors.green}SIGNED${colors.reset} (valid)`);
        signatures.push(response);
      } else {
        console.log(`${colors.red}INVALID SIGNATURE${colors.reset}`);
        failedAttesters.push(attester.name);
      }
    } else {
      console.log(`${colors.red}FAILED${colors.reset}`);
      failedAttesters.push(attester.name);
    }

    // Stop if we have enough signatures
    if (signatures.length >= REQUIRED_SIGNATURES) {
      log(colors.green, `\n  ✓ Collected ${REQUIRED_SIGNATURES} signatures - threshold reached!`);
      break;
    }
  }

  // Step 4: Results
  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.blue, '   Test Results');
  log(colors.blue, '═══════════════════════════════════════════════════════════\n');

  log(colors.cyan, `Signatures collected: ${signatures.length}/${REQUIRED_SIGNATURES} required`);

  if (signatures.length >= REQUIRED_SIGNATURES) {
    log(colors.green, '\n✓ SUCCESS: Threshold met - attestation can proceed!\n');

    log(colors.yellow, 'Collected signatures:');
    for (const sig of signatures) {
      log(colors.cyan, `  ${sig.attesterName}:`);
      log(colors.dim, `    Address: ${sig.address}`);
      log(colors.dim, `    Signature: ${sig.signature.slice(0, 42)}...`);
    }

    // Create aggregated attestation
    const attestation = {
      messageHash,
      signatures: signatures.map(s => ({
        attesterId: s.attesterId,
        address: s.address,
        publicKey: s.publicKey,
        signature: s.signature,
      })),
      threshold: REQUIRED_SIGNATURES,
      collectedAt: new Date().toISOString(),
    };

    // Save attestation to file
    const outputFile = path.join(__dirname, '../secrets/test-attestation-result.json');
    fs.writeFileSync(outputFile, JSON.stringify(attestation, null, 2));
    log(colors.green, `\nAttestation saved to: ${outputFile}`);

  } else {
    log(colors.red, `\n✗ FAILURE: Only ${signatures.length} signatures collected`);
    log(colors.red, `  Need ${REQUIRED_SIGNATURES - signatures.length} more for threshold\n`);

    if (failedAttesters.length > 0) {
      log(colors.yellow, 'Failed attesters:');
      for (const name of failedAttesters) {
        log(colors.red, `  - ${name}`);
      }
    }

    process.exit(1);
  }

  log(colors.blue, '\n═══════════════════════════════════════════════════════════');
  log(colors.green, 'Test completed successfully!');
  log(colors.blue, '═══════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
