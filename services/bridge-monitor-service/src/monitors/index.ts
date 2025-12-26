/**
 * Bridge Monitors
 *
 * Export all blockchain monitors for the Ëtrid bridge service
 */

// Bitcoin
export { BitcoinMonitor, BitcoinNetwork } from './BitcoinMonitor';

// Re-export MonitorStatus from types
export type { MonitorStatus } from '../types';

// Solana
export { SolanaMonitor } from './SolanaMonitor';

// EVM Chains (Ethereum, BNB Chain, Polygon, Arbitrum, Base)
export { EvmMonitor } from './EvmMonitor';

// Tron
export { TronMonitor, TronNetwork } from './TronMonitor';
export type { TronMonitorConfig, TronDepositEvent, TRC20TokenConfig } from './TronMonitor';

// XRP Ledger
export { XrpMonitor } from './XrpMonitor';
export type { XrpMonitorConfig, XrpDepositEvent } from './XrpMonitor';

// Cardano
export { CardanoMonitor } from './CardanoMonitor';
export type { CardanoMonitorConfig, CardanoDepositEvent, CardanoUtxo } from './CardanoMonitor';

// Stellar
export { StellarMonitor } from './StellarMonitor';
export type { StellarMonitorConfig, StellarDepositEvent } from './StellarMonitor';
