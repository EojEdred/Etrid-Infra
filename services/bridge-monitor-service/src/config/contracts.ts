/**
 * ËTRID Bridge Monitor Service - Contract ABIs and Addresses
 *
 * Contract interfaces and ABIs for all bridge-related smart contracts
 */

// ============================================================================
// EDSC TOKEN ABI
// ============================================================================
export const EDSC_ABI = [
  // ERC20 Standard
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',

  // EDSC Specific
  'function messageTransmitter() view returns (address)',
  'function paused() view returns (bool)',
  'function mint(address recipient, uint256 amount, uint64 nonce)',
  'function burn(address sender, uint256 amount, uint64 nonce)',
  'function setMessageTransmitter(address _messageTransmitter)',
  'function pause()',
  'function unpause()',

  // Events
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event MessageTransmitterUpdated(address indexed oldTransmitter, address indexed newTransmitter)',
  'event PauseStateChanged(bool paused)',
  'event CrossChainMint(address indexed recipient, uint256 amount, uint64 nonce)',
  'event CrossChainBurn(address indexed sender, uint256 amount, uint64 nonce)'
] as const;

// ============================================================================
// MESSAGE TRANSMITTER ABI
// ============================================================================
export const MESSAGE_TRANSMITTER_ABI = [
  // View Functions
  'function edscToken() view returns (address)',
  'function attesterRegistry() view returns (address)',
  'function LOCAL_DOMAIN() view returns (uint32)',
  'function ETRID_DOMAIN() view returns (uint32)',
  'function paused() view returns (bool)',
  'function totalMessagesReceived() view returns (uint256)',
  'function totalEDSCMinted() view returns (uint256)',
  'function getStatistics() view returns (uint256 received, uint256 minted)',

  // State Changing
  'function receiveMessage(bytes calldata _message, bytes[] calldata _signatures)',
  'function pause()',
  'function unpause()',

  // Events
  'event MessageReceived(uint32 indexed sourceDomain, uint64 indexed nonce, address indexed recipient, uint256 amount)',
  'event EDSCMinted(address indexed recipient, uint256 amount, uint64 nonce)',
  'event PauseStateChanged(bool paused)'
] as const;

// ============================================================================
// TOKEN MESSENGER ABI
// ============================================================================
export const TOKEN_MESSENGER_ABI = [
  // View Functions
  'function edscToken() view returns (address)',
  'function LOCAL_DOMAIN() view returns (uint32)',
  'function ETRID_DOMAIN() view returns (uint32)',
  'function maxBurnAmount() view returns (uint256)',
  'function dailyBurnLimit() view returns (uint256)',
  'function BLOCKS_PER_DAY() view returns (uint256)',
  'function nonce() view returns (uint64)',
  'function dailyBurnVolume() view returns (uint256)',
  'function dailyBurnResetBlock() view returns (uint256)',
  'function paused() view returns (bool)',
  'function totalMessagesSent() view returns (uint256)',
  'function totalEDSCBurned() view returns (uint256)',
  'function getStatistics() view returns (uint256 sent, uint256 burned)',
  'function getDailyBurnStatus() view returns (uint256 volume, uint256 limit, uint256 resetBlock, uint256 blocksUntilReset)',
  'function getMessage(uint64 _nonce) view returns (tuple(uint32 destinationDomain, address sender, bytes recipient, uint256 amount, uint64 nonce, uint256 timestamp))',

  // State Changing
  'function burnAndSend(bytes calldata _recipient, uint256 _amount)',
  'function burnAndSendTo(uint32 _destinationDomain, bytes calldata _recipient, uint256 _amount)',
  'function updateBurnLimits(uint256 _maxBurnAmount, uint256 _dailyBurnLimit)',
  'function pause()',
  'function unpause()',

  // Events
  'event MessageSent(uint32 indexed destinationDomain, uint64 indexed nonce, address indexed sender, bytes recipient, uint256 amount)',
  'event BurnLimitUpdated(uint256 maxBurnAmount, uint256 dailyBurnLimit)',
  'event PauseStateChanged(bool paused)'
] as const;

// ============================================================================
// ATTESTER REGISTRY ABI
// ============================================================================
export const ATTESTER_REGISTRY_ABI = [
  // View Functions
  'function owner() view returns (address)',
  'function minSignatures() view returns (uint256)',
  'function totalAttesters() view returns (uint256)',
  'function isAttester(address _attester) view returns (bool)',
  'function attesters(uint256 index) view returns (address)',
  'function usedNonces(uint32 domain, uint64 nonce) view returns (bool)',

  // State Changing
  'function addAttester(address _attester)',
  'function removeAttester(address _attester)',
  'function updateMinSignatures(uint256 _minSignatures)',
  'function verifySignatures(bytes32 _messageHash, bytes[] calldata _signatures, uint32 _sourceDomain, uint64 _nonce) returns (bool)',

  // Events
  'event AttesterAdded(address indexed attester)',
  'event AttesterRemoved(address indexed attester)',
  'event MinSignaturesUpdated(uint256 minSignatures)',
  'event NonceUsed(uint32 indexed domain, uint64 indexed nonce)'
] as const;

// ============================================================================
// ERC20 TOKEN ABI (for ETR on EVM chains)
// ============================================================================
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
] as const;

// ============================================================================
// PANCAKESWAP / UNISWAP PAIR ABI (for price feeds)
// ============================================================================
export const PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() external view returns (uint256)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)'
] as const;

// ============================================================================
// PANCAKESWAP FACTORY ABI
// ============================================================================
export const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint256) external view returns (address pair)',
  'function allPairsLength() external view returns (uint256)',
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint256)'
] as const;

// ============================================================================
// CONTRACT ADDRESSES
// ============================================================================

// BSC Mainnet DEX Addresses
export const BSC_MAINNET_DEX = {
  pancakeswapRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  pancakeswapFactory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  usdt: '0x55d398326f99059fF775485246999027B3197955',
  usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
} as const;

// Ethereum Mainnet Addresses
export const ETHEREUM_MAINNET_CONTRACTS = {
  edsc: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Production address
  attesterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
} as const;

// BSC Mainnet Token Addresses
export const BSC_MAINNET_TOKENS = {
  etr: '0xcc9b37fed77a01329502f8844620577742eb0dc6', // Production BSC ETR
  usdt: '0x55d398326f99059fF775485246999027B3197955',
  busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
} as const;

// Solana Mainnet Token Addresses
export const SOLANA_MAINNET_TOKENS = {
  etr: 'CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp', // Production Solana ETR SPL
  h256: '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f'
} as const;

// ============================================================================
// CROSS-CHAIN MESSAGE TYPES
// ============================================================================

export interface CrossChainMessage {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: Uint8Array;
  recipient: Uint8Array;
  messageBody: Uint8Array;
}

export interface BurnMessage {
  version: number;
  burnToken: Uint8Array;
  mintRecipient: Uint8Array;
  amount: bigint;
}

export interface OutboundMessage {
  destinationDomain: number;
  sender: string;
  recipient: Uint8Array;
  amount: bigint;
  nonce: bigint;
  timestamp: bigint;
}

// ============================================================================
// DOMAIN IDENTIFIERS
// ============================================================================
export const DOMAINS = {
  ETHEREUM: 0,
  AVALANCHE: 1,
  ETRID: 2,
  BSC: 3,
  POLYGON: 4,
  SOLANA: 5,
  TRON: 6,
  XRP: 7,
  BITCOIN: 8
} as const;

export type DomainId = typeof DOMAINS[keyof typeof DOMAINS];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get contract address for a specific network
 */
export function getContractAddress(
  contract: 'edsc' | 'messageTransmitter' | 'tokenMessenger' | 'attesterRegistry',
  network: 'mainnet' | 'testnet' | 'localhost'
): string {
  if (network === 'localhost' || network === 'testnet') {
    return ETHEREUM_MAINNET_CONTRACTS[contract];
  }

  // Return production addresses
  return ETHEREUM_MAINNET_CONTRACTS[contract];
}

/**
 * Get token address for a specific chain
 */
export function getTokenAddress(
  token: 'etr' | 'usdt' | 'usdc' | 'busd',
  chain: 'ethereum' | 'bsc' | 'solana' | 'polygon'
): string {
  if (chain === 'bsc') {
    return BSC_MAINNET_TOKENS[token as keyof typeof BSC_MAINNET_TOKENS] || '';
  }

  if (chain === 'solana' && token === 'etr') {
    return SOLANA_MAINNET_TOKENS.etr;
  }

  return '';
}

/**
 * Get DEX factory address for chain
 */
export function getDexFactory(chain: 'bsc' | 'ethereum' | 'polygon'): string {
  if (chain === 'bsc') {
    return BSC_MAINNET_DEX.pancakeswapFactory;
  }

  // Add Uniswap/other DEX addresses as needed
  return '';
}
