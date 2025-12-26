# Attestation Submission Integration

This module provides integration between the bridge-monitor-service and PBC (Partition Burst Chain) attestation pallets.

## Overview

The `AttestationSubmitter` connects to PBC chains via WebSocket and submits attestations to the `pallet-bridge-attestation` pallet. It handles:

- WebSocket connection management
- Extrinsic submission with retry logic
- Transaction status tracking
- Attestation verification status queries

## Architecture

```
┌─────────────────────────┐
│ Bridge Monitor Service  │
│                         │
│  ┌──────────────────┐   │
│  │ Attestation      │   │
│  │ Submitter        │   │
│  └────────┬─────────┘   │
└───────────┼─────────────┘
            │ WebSocket
            ▼
┌─────────────────────────┐
│ PBC Chains (Substrate)  │
│                         │
│  ┌──────────────────┐   │
│  │ pallet-bridge-   │   │
│  │ attestation      │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

## Installation

The module is already part of the bridge-monitor-service. Dependencies are included in the main `package.json`:

```json
{
  "@polkadot/api": "^10.11.1",
  "@polkadot/keyring": "^12.6.2",
  "@polkadot/util": "^12.6.2",
  "@polkadot/util-crypto": "^12.6.2"
}
```

## Configuration

PBC endpoints are configured in `/config/pbc-endpoints.json`:

```json
{
  "chains": {
    "ethereum-pbc": {
      "name": "Ethereum PBC",
      "wsEndpoint": "ws://10.0.0.103:9944",
      "httpEndpoint": "http://10.0.0.103:9933",
      "chainId": 3,
      "enabled": true
    }
  }
}
```

## Usage

### Basic Usage

```typescript
import { AttestationSubmitter } from './attestation';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

// Initialize
await cryptoWaitReady();
const keyring = new Keyring({ type: 'sr25519' });
const signer = keyring.addFromUri(process.env.RELAYER_PRIVATE_KEY);

// Load configuration
const config = {
  chains: {
    'ethereum-pbc': {
      name: 'Ethereum PBC',
      wsEndpoint: 'ws://10.0.0.103:9944',
      httpEndpoint: 'http://10.0.0.103:9933',
      chainId: 3,
      enabled: true,
    }
  },
  defaultRetries: 3,
  retryDelayMs: 2000,
  timeout: 60000,
};

// Create submitter
const submitter = new AttestationSubmitter(config);

// Submit attestation
const result = await submitter.submitAttestation({
  pbcEndpoint: 'ws://10.0.0.103:9944',
  messageHash: '0x1234...abcd',
  signatures: [
    {
      attester: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      signature: '0xabcd...1234',
    },
  ],
  signerKeypair: signer,
});

if (result.success) {
  console.log('Transaction hash:', result.txHash);
} else {
  console.error('Error:', result.error);
}

// Clean up
await submitter.disconnectAll();
```

### Advanced Options

```typescript
const result = await submitter.submitAttestation(
  {
    pbcEndpoint: 'ws://10.0.0.103:9944',
    messageHash: '0x1234...abcd',
    signatures: [/* ... */],
    signerKeypair: signer,
  },
  {
    maxRetries: 5,
    retryDelay: 1000,
    waitForFinalization: true,
    nonce: 42, // Optional nonce
    tip: 1000n, // Optional tip for priority
  }
);
```

### Check Attestation Status

```typescript
const status = await submitter.getAttestationStatus(
  'ws://10.0.0.103:9944',
  '0x1234...abcd'
);

if (status) {
  console.log('Verified:', status.isVerified);
  console.log('Attestations:', status.attestations);
  console.log('Required:', status.requiredAttestations);
}
```

### Submit to Multiple PBCs

```typescript
const chains = ['ethereum-pbc', 'solana-pbc', 'polygon-pbc'];

const results = await Promise.all(
  chains.map((chain) =>
    submitter.submitAttestation({
      pbcEndpoint: config.chains[chain].wsEndpoint,
      messageHash: messageHash,
      signatures: signatures,
      signerKeypair: signer,
    })
  )
);

results.forEach((result, index) => {
  console.log(`${chains[index]}: ${result.success ? '✅' : '❌'}`);
});
```

## API Reference

### AttestationSubmitter

Main class for submitting attestations to PBC chains.

#### Methods

##### `submitAttestation(params, options?)`

Submit an attestation to a PBC chain.

**Parameters:**
- `params: SubmitAttestationParams`
  - `pbcEndpoint: string` - WebSocket endpoint
  - `messageHash: string` - Message hash (H256)
  - `signatures: AttesterSignature[]` - Array of attester signatures
  - `signerKeypair: KeyringPair` - Signer for extrinsic
  - `message?: string` - Optional full message bytes
- `options?: SubmissionOptions`
  - `maxRetries?: number` - Max retry attempts (default: 3)
  - `retryDelay?: number` - Delay between retries (default: 2000ms)
  - `waitForFinalization?: boolean` - Wait for finalization (default: true)
  - `nonce?: number` - Optional nonce
  - `tip?: bigint` - Optional tip

**Returns:** `Promise<AttestationSubmissionResult>`
```typescript
{
  success: boolean;
  txHash?: string;
  blockHash?: string;
  blockNumber?: number;
  error?: string;
  chainName: string;
  timestamp: number;
}
```

##### `getAttestationStatus(pbcEndpoint, messageHash)`

Query attestation status on a PBC chain.

**Parameters:**
- `pbcEndpoint: string` - WebSocket endpoint
- `messageHash: string` - Message hash to query

**Returns:** `Promise<AttestationStatus | null>`
```typescript
{
  messageHash: string;
  isVerified: boolean;
  attestations: number;
  requiredAttestations: number;
  attesters: string[];
  submittedAt?: number;
}
```

##### `getStats()`

Get submission statistics.

**Returns:**
```typescript
{
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  successRate: number;
  connectedChains: string[];
}
```

##### `disconnectAll()`

Disconnect from all PBC chains.

**Returns:** `Promise<void>`

##### `isConnected(chainName)`

Check if connected to a specific chain.

**Parameters:**
- `chainName: string` - Chain name

**Returns:** `boolean`

##### `getConfiguredChains()`

Get list of all configured and enabled chains.

**Returns:** `string[]`

## Types

### AttesterSignature

```typescript
interface AttesterSignature {
  attester: string; // Attester SS58 address
  signature: string; // Hex-encoded signature
}
```

### SubmitAttestationParams

```typescript
interface SubmitAttestationParams {
  pbcEndpoint: string;
  messageHash: string;
  signatures: AttesterSignature[];
  signerKeypair: KeyringPair;
  message?: string;
}
```

### AttestationSubmissionResult

```typescript
interface AttestationSubmissionResult {
  success: boolean;
  txHash?: string;
  blockHash?: string;
  blockNumber?: number;
  error?: string;
  chainName: string;
  timestamp: number;
}
```

### PbcChainConfig

```typescript
interface PbcChainConfig {
  name: string;
  wsEndpoint: string;
  httpEndpoint: string;
  chainId: number;
  enabled: boolean;
}
```

## PBC Pallet Interface

The `pallet-bridge-attestation` exposes the following extrinsic:

```rust
#[pallet::call]
impl<T: Config> Pallet<T> {
    /// Submit attestation for a cross-chain message
    pub fn submit_attestation(
        origin: OriginFor<T>,
        message_hash: T::Hash,
        signatures: Vec<Vec<u8>>,
        attesters: Vec<T::AccountId>,
    ) -> DispatchResult {
        // Verify signatures
        // Store attestations
        // Check if threshold met
        // Mark message as verified if threshold met
    }
}
```

## Examples

See `example.ts` for comprehensive usage examples:

```bash
# Run specific example
ts-node src/attestation/example.ts 1

# Run all examples
ts-node src/attestation/example.ts all
```

Examples include:
1. Submit to Ethereum PBC
2. Submit to multiple PBCs in parallel
3. Retry logic demonstration
4. Check attestation status
5. List configured chains

## Error Handling

The submitter includes comprehensive error handling:

- **Connection errors**: Automatic retry with exponential backoff
- **Dispatch errors**: Detailed error messages from pallet
- **Transaction failures**: Status tracking (invalid, dropped, timeout)
- **Network issues**: Configurable timeouts and retries

Example:

```typescript
try {
  const result = await submitter.submitAttestation(params);
  if (!result.success) {
    console.error('Submission failed:', result.error);
    // Handle error (e.g., retry, alert, log)
  }
} catch (error) {
  console.error('Fatal error:', error);
  // Handle critical failure
}
```

## Monitoring

Track submission metrics:

```typescript
const stats = submitter.getStats();
console.log('Success rate:', stats.successRate, '%');
console.log('Total submissions:', stats.totalSubmissions);
console.log('Connected chains:', stats.connectedChains);
```

## Production Considerations

### Security

1. **Private Keys**: Store relayer private keys in secure key management systems (e.g., AWS KMS, HashiCorp Vault)
2. **Access Control**: Restrict network access to PBC endpoints
3. **TLS/WSS**: Use encrypted WebSocket connections for production
4. **Signature Verification**: Validate attester signatures before submission

### Performance

1. **Connection Pooling**: Reuse WebSocket connections across submissions
2. **Batch Submissions**: Group multiple attestations when possible
3. **Parallel Processing**: Submit to multiple PBCs concurrently
4. **Timeout Configuration**: Adjust timeouts based on network conditions

### Reliability

1. **Retry Logic**: Configure retries based on failure patterns
2. **Fallback Endpoints**: Configure backup RPC endpoints
3. **Health Checks**: Monitor PBC chain availability
4. **Transaction Tracking**: Store submission receipts for audit

### Example Production Config

```typescript
const productionConfig = {
  chains: {
    'ethereum-pbc': {
      name: 'Ethereum PBC',
      wsEndpoint: 'wss://ethereum-pbc.etrid.network',
      httpEndpoint: 'https://ethereum-pbc-rpc.etrid.network',
      chainId: 3,
      enabled: true,
    },
  },
  defaultRetries: 5,
  retryDelayMs: 3000,
  timeout: 120000, // 2 minutes
};
```

## Troubleshooting

### Connection Failed

```
Error: Failed to connect to PBC
```

**Solution:**
- Verify endpoint URL is correct
- Check network connectivity
- Ensure PBC node is running
- Check firewall rules

### Pallet Not Found

```
Error: pallet-bridge-attestation not found on chain
```

**Solution:**
- Verify the PBC runtime includes `pallet-bridge-attestation`
- Check chain metadata with Polkadot.js Apps
- Ensure correct runtime version

### Dispatch Error

```
Error: attestation.InvalidSignature: Signature verification failed
```

**Solution:**
- Verify signature format (hex-encoded, correct length)
- Check attester addresses are valid
- Ensure attester is authorized in pallet config

### Transaction Dropped

```
Status: dropped
```

**Solution:**
- Check account balance for fees
- Verify nonce is correct
- Increase tip for priority
- Check transaction pool status

## Testing

Run unit tests:

```bash
npm test -- src/attestation
```

Integration tests require running PBC nodes locally.

## License

Apache-2.0

## Support

For issues and questions:
- GitHub Issues: https://github.com/etrid/etrid
- Discord: https://discord.gg/etrid
- Documentation: https://docs.etrid.network
