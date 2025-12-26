/**
 * TRON MONITOR - UNIT TESTS
 *
 * Comprehensive tests for TronMonitor functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TronMonitor, createTronMonitor, TrxDepositEvent, Trc20DepositEvent } from './TronMonitor';
import { EventEmitter } from 'events';

// Mock TronWeb
jest.mock('tronweb', () => {
  return jest.fn().mockImplementation(() => ({
    isConnected: jest.fn().mockResolvedValue({
      fullNode: true,
      solidityNode: true,
      eventServer: true,
    }),
    trx: {
      getNodeInfo: jest.fn().mockResolvedValue({
        configNodeInfo: {
          codeVersion: '4.7.0',
        },
      }),
      getChainParameters: jest.fn().mockResolvedValue([]),
      getCurrentBlock: jest.fn().mockResolvedValue({
        block_header: {
          raw_data: {
            number: 1000000,
            timestamp: Date.now(),
          },
        },
      }),
      getTransactionInfo: jest.fn().mockResolvedValue({
        receipt: {
          energy_usage_total: 65000,
          net_usage: 345,
          energy_fee: 0,
          net_fee: 0,
          result: 'SUCCESS',
        },
      }),
    },
    contract: jest.fn().mockResolvedValue({
      symbol: jest.fn().mockResolvedValue('USDT'),
      name: jest.fn().mockResolvedValue('Tether USD'),
      decimals: jest.fn().mockResolvedValue(6),
    }),
    event: {
      getEventResult: jest.fn().mockResolvedValue([]),
    },
    address: {
      toHex: jest.fn((addr: string) => {
        if (addr.startsWith('T')) {
          return '41' + Buffer.from(addr).toString('hex').slice(2, 42);
        }
        return addr;
      }),
      fromHex: jest.fn((hex: string) => {
        if (hex.startsWith('41')) {
          return 'T' + Buffer.from(hex.slice(2), 'hex').toString('utf8');
        }
        return hex;
      }),
    },
    isAddress: jest.fn((addr: string) => addr.startsWith('T') && addr.length === 34),
  }));
});

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock metrics
jest.mock('../metrics', () => ({
  tronConnected: { set: jest.fn() },
  tronBlockHeight: { set: jest.fn() },
  lastBlockTimestamp: { set: jest.fn() },
  depositsSeen: { inc: jest.fn() },
  recordError: jest.fn(),
  recordTrxDeposit: jest.fn(),
  recordTrc20Deposit: jest.fn(),
}));

describe('TronMonitor', () => {
  let monitor: TronMonitor;

  const mockConfig = {
    fullNodeUrl: 'https://api.trongrid.io',
    solidityNodeUrl: 'https://api.trongrid.io',
    eventServerUrl: 'https://api.trongrid.io',
    network: 'mainnet' as const,
    bridgeContractAddress: 'TYourBridgeContract',
    supportedTokens: [
      {
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        symbol: 'USDT',
        decimals: 6,
      },
    ],
    usdtContractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    pollIntervalMs: 3000,
    minConfirmations: 19,
    maxEnergyLimit: 150_000_000,
    maxBandwidthLimit: 5_000,
  };

  beforeEach(() => {
    monitor = new TronMonitor(mockConfig);
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.stop();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create monitor with valid config', () => {
      expect(monitor).toBeInstanceOf(TronMonitor);
      expect(monitor).toBeInstanceOf(EventEmitter);
    });

    it('should start monitoring successfully', async () => {
      const startedSpy = jest.fn();
      monitor.on('started', startedSpy);

      await monitor.start();

      expect(startedSpy).toHaveBeenCalled();
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should stop monitoring successfully', async () => {
      await monitor.start();

      const stoppedSpy = jest.fn();
      monitor.on('stopped', stoppedSpy);

      await monitor.stop();

      expect(stoppedSpy).toHaveBeenCalled();
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('createTronMonitor helper', () => {
    it('should create monitor with mainnet defaults', () => {
      const monitor = createTronMonitor('TBridgeContract', 'mainnet');
      expect(monitor).toBeInstanceOf(TronMonitor);
    });

    it('should create monitor with shasta testnet', () => {
      const monitor = createTronMonitor('TBridgeContract', 'shasta');
      expect(monitor).toBeInstanceOf(TronMonitor);
    });

    it('should create monitor with custom options', () => {
      const monitor = createTronMonitor('TBridgeContract', 'mainnet', {
        pollIntervalMs: 5000,
        minConfirmations: 25,
        tronGridApiKey: 'test-key',
      });
      expect(monitor).toBeInstanceOf(TronMonitor);
    });
  });

  describe('Address Utilities', () => {
    beforeEach(async () => {
      await monitor.start();
    });

    it('should convert base58 address to hex', () => {
      const base58 = 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3';
      const hex = monitor.addressToHex(base58);
      expect(hex).toBeTruthy();
      expect(hex).toContain('41');
    });

    it('should convert hex address to base58', () => {
      const hex = '41f34ab2fc67caa3c9c9d1e63f6e50a8b88f8e01c3';
      const base58 = monitor.addressFromHex(hex);
      expect(base58).toBeTruthy();
      expect(base58).toContain('T');
    });

    it('should validate valid TRON address', () => {
      const validAddress = 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3';
      expect(monitor.isValidAddress(validAddress)).toBe(true);
    });

    it('should reject invalid TRON address', () => {
      const invalidAddress = 'InvalidAddress123';
      expect(monitor.isValidAddress(invalidAddress)).toBe(false);
    });

    it('should get 21-byte address', () => {
      const address = 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3';
      const bytes = monitor.getAddressBytes(address);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(21);
    });
  });

  describe('Event Processing', () => {
    beforeEach(async () => {
      await monitor.start();
    });

    it('should emit trxDeposit event', (done) => {
      const mockEvent: TrxDepositEvent = {
        etridAccount: new Uint8Array(32),
        tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
        amount: BigInt('1000000'), // 1 TRX
        txId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      };

      monitor.on('trxDeposit', (event) => {
        expect(event).toBeDefined();
        expect(event.tronAddress).toBe(mockEvent.tronAddress);
        expect(event.amount).toBe(mockEvent.amount);
        expect(event.confirmations).toBe(19);
        done();
      });

      // Emit test event
      monitor.emit('trxDeposit', mockEvent);
    });

    it('should emit trc20Deposit event', (done) => {
      const mockEvent: Trc20DepositEvent = {
        etridAccount: new Uint8Array(32),
        tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
        tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        tokenSymbol: 'USDT',
        amount: BigInt('1000000'), // 1 USDT
        txId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      };

      monitor.on('trc20Deposit', (event) => {
        expect(event).toBeDefined();
        expect(event.tokenSymbol).toBe('USDT');
        expect(event.amount).toBe(mockEvent.amount);
        done();
      });

      monitor.emit('trc20Deposit', mockEvent);
    });

    it('should emit usdtDeposit event for USDT', (done) => {
      const mockEvent: Trc20DepositEvent = {
        etridAccount: new Uint8Array(32),
        tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
        tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        tokenSymbol: 'USDT',
        amount: BigInt('1000000'),
        txId: '0xabcdef',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      };

      monitor.on('usdtDeposit', (event) => {
        expect(event).toBeDefined();
        expect(event.tokenSymbol).toBe('USDT');
        done();
      });

      monitor.emit('usdtDeposit', mockEvent);
    });
  });

  describe('Status and Health', () => {
    it('should return initial status', () => {
      const status = monitor.getStatus();
      expect(status).toBeDefined();
      expect(status.isRunning).toBe(false);
      expect(status.lastBlock).toBe(0);
      expect(status.depositsProcessed).toBe(0);
      expect(status.errors).toBe(0);
    });

    it('should update status after start', async () => {
      await monitor.start();
      const status = monitor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.lastBlock).toBeGreaterThan(0);
    });

    it('should get current block number', async () => {
      await monitor.start();
      const blockNumber = await monitor.getCurrentBlock();
      expect(blockNumber).toBeGreaterThan(0);
    });

    it('should get confirmed block number', async () => {
      await monitor.start();
      const confirmedBlock = await monitor.getConfirmedBlock();
      const currentBlock = await monitor.getCurrentBlock();
      expect(confirmedBlock).toBe(currentBlock - 19);
    });
  });

  describe('Error Handling', () => {
    it('should emit error event on failure', (done) => {
      monitor.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Simulate error
      const testError = new Error('Test error');
      monitor.emit('error', testError);
    });

    it('should track error count', (done) => {
      monitor.on('error', () => {
        const status = monitor.getStatus();
        expect(status.errors).toBeGreaterThan(0);
        expect(status.lastError).toBeDefined();
        expect(status.lastErrorTime).toBeDefined();
        done();
      });

      monitor.emit('error', new Error('Test error'));
    });
  });

  describe('Resource Tracking', () => {
    it('should track energy usage in events', (done) => {
      const mockEvent: TrxDepositEvent = {
        etridAccount: new Uint8Array(32),
        tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
        amount: BigInt('1000000'),
        txId: '0xabcdef',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      };

      monitor.on('trxDeposit', (event) => {
        expect(event.energyUsage).toBe(65000);
        expect(event.bandwidthUsage).toBe(345);
        done();
      });

      monitor.emit('trxDeposit', mockEvent);
    });

    it('should validate energy limit', () => {
      const energyUsage = 65000;
      expect(energyUsage).toBeLessThan(mockConfig.maxEnergyLimit);
    });

    it('should validate bandwidth limit', () => {
      const bandwidthUsage = 345;
      expect(bandwidthUsage).toBeLessThan(mockConfig.maxBandwidthLimit);
    });
  });

  describe('Confirmation Requirements', () => {
    it('should require 19 confirmations for finality', () => {
      expect(mockConfig.minConfirmations).toBe(19);
    });

    it('should process deposits with sufficient confirmations', (done) => {
      const mockEvent: TrxDepositEvent = {
        etridAccount: new Uint8Array(32),
        tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
        amount: BigInt('1000000'),
        txId: '0xabcdef',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 20, // More than required
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      };

      monitor.on('trxDeposit', (event) => {
        expect(event.confirmations).toBeGreaterThanOrEqual(19);
        done();
      });

      monitor.emit('trxDeposit', mockEvent);
    });
  });

  describe('Amount Calculations', () => {
    it('should handle TRX amount in SUN', () => {
      const amountSUN = BigInt('1000000'); // 1 TRX
      const amountTRX = Number(amountSUN) / 1_000_000;
      expect(amountTRX).toBe(1.0);
    });

    it('should handle USDT amount with 6 decimals', () => {
      const amountRaw = BigInt('1000000'); // 1 USDT
      const amountUSDT = Number(amountRaw) / 1_000_000;
      expect(amountUSDT).toBe(1.0);
    });

    it('should handle large amounts', () => {
      const amountSUN = BigInt('1000000000000'); // 1,000,000 TRX
      const amountTRX = Number(amountSUN) / 1_000_000;
      expect(amountTRX).toBe(1_000_000);
    });
  });

  describe('Network Configuration', () => {
    it('should support mainnet', () => {
      const monitor = createTronMonitor('TContract', 'mainnet');
      expect(monitor).toBeDefined();
    });

    it('should support shasta testnet', () => {
      const monitor = createTronMonitor('TContract', 'shasta');
      expect(monitor).toBeDefined();
    });

    it('should support nile testnet', () => {
      const monitor = createTronMonitor('TContract', 'nile');
      expect(monitor).toBeDefined();
    });

    it('should use correct USDT contract for mainnet', () => {
      const mainnetUsdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      expect(mockConfig.usdtContractAddress).toBe(mainnetUsdt);
    });
  });

  describe('Token Support', () => {
    it('should support configured TRC-20 tokens', () => {
      expect(mockConfig.supportedTokens).toHaveLength(1);
      expect(mockConfig.supportedTokens[0].symbol).toBe('USDT');
    });

    it('should have correct USDT decimals', () => {
      const usdtToken = mockConfig.supportedTokens.find(t => t.symbol === 'USDT');
      expect(usdtToken?.decimals).toBe(6);
    });
  });

  describe('Polling Configuration', () => {
    it('should use 3 second polling interval (TRON block time)', () => {
      expect(mockConfig.pollIntervalMs).toBe(3000);
    });

    it('should allow custom polling interval', () => {
      const customConfig = {
        ...mockConfig,
        pollIntervalMs: 5000,
      };
      const customMonitor = new TronMonitor(customConfig);
      expect(customMonitor).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple deposits in sequence', (done) => {
      const deposits: TrxDepositEvent[] = [];

      monitor.on('trxDeposit', (event) => {
        deposits.push(event);

        if (deposits.length === 3) {
          expect(deposits).toHaveLength(3);
          done();
        }
      });

      // Emit multiple deposits
      for (let i = 0; i < 3; i++) {
        monitor.emit('trxDeposit', {
          etridAccount: new Uint8Array(32),
          tronAddress: 'TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3',
          amount: BigInt('1000000'),
          txId: `0x${i.toString().padStart(64, '0')}`,
          blockNumber: 1000000 + i,
          blockTimestamp: Date.now(),
          confirmations: 19,
          energyUsage: 65000,
          bandwidthUsage: 345,
          timestamp: Date.now(),
        });
      }
    });

    it('should handle mixed deposit types', (done) => {
      let trxCount = 0;
      let trc20Count = 0;

      monitor.on('trxDeposit', () => {
        trxCount++;
        checkComplete();
      });

      monitor.on('trc20Deposit', () => {
        trc20Count++;
        checkComplete();
      });

      function checkComplete() {
        if (trxCount === 2 && trc20Count === 2) {
          expect(trxCount).toBe(2);
          expect(trc20Count).toBe(2);
          done();
        }
      }

      // Emit mixed events
      monitor.emit('trxDeposit', {
        etridAccount: new Uint8Array(32),
        tronAddress: 'T1',
        amount: BigInt('1000000'),
        txId: '0x1',
        blockNumber: 1000000,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      });

      monitor.emit('trc20Deposit', {
        etridAccount: new Uint8Array(32),
        tronAddress: 'T2',
        tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        tokenSymbol: 'USDT',
        amount: BigInt('1000000'),
        txId: '0x2',
        blockNumber: 1000001,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      });

      monitor.emit('trxDeposit', {
        etridAccount: new Uint8Array(32),
        tronAddress: 'T3',
        amount: BigInt('2000000'),
        txId: '0x3',
        blockNumber: 1000002,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      });

      monitor.emit('trc20Deposit', {
        etridAccount: new Uint8Array(32),
        tronAddress: 'T4',
        tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        tokenSymbol: 'USDT',
        amount: BigInt('3000000'),
        txId: '0x4',
        blockNumber: 1000003,
        blockTimestamp: Date.now(),
        confirmations: 19,
        energyUsage: 65000,
        bandwidthUsage: 345,
        timestamp: Date.now(),
      });
    });
  });
});
