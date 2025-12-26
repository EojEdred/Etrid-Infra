// In-memory database for development
// Replace with PostgreSQL/SQLite for production

interface DCABot {
  id: string;
  userId: string;
  name: string;
  sourceAsset: string;
  targetAsset: string;
  amount: number;
  frequency: string;
  status: string;
  nextExecution: string;
  totalInvested: number;
  averagePrice: number;
  createdAt: string;
}

interface DCAExecution {
  id: string;
  botId: string;
  amount: number;
  price: number;
  tokensReceived: number;
  status: string;
  executedAt: string;
}

interface Card {
  id: string;
  userId: string;
  cardNumber: string;
  cardholderName: string;
  expiryDate: string;
  cvv: string;
  status: string;
  cardType: string;
  cryptoAsset: string;
  collateralAmount: number;
  collateralValueUSD: number;
  availableAmount: number;
  ltv: number;
  liquidationThreshold: number;
  dailyLimit: number;
  monthlyLimit: number;
  perTransactionLimit: number;
  dailySpent: number;
  monthlySpent: number;
  createdAt: string;
}

interface CardTransaction {
  id: string;
  cardId: string;
  merchantName: string;
  merchantCategory: string;
  amount: number;
  currency: string;
  status: string;
  nfcTransaction: boolean;
  createdAt: string;
}

interface DAO {
  id: string;
  name: string;
  description: string;
  governanceToken: string;
  treasury: number;
  members: number;
  votingThreshold: number;
  proposalDeposit: number;
  votingPeriod: number;
}

interface DAOMember {
  id: string;
  daoId: string;
  address: string;
  votingPower: number;
  joinedAt: string;
}

interface Proposal {
  id: string;
  daoId: string;
  title: string;
  description: string;
  proposer: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  threshold: number;
  startBlock: number;
  endBlock: number;
  createdAt: string;
}

interface Vote {
  id: string;
  proposalId: string;
  voter: string;
  voteType: string;
  votingPower: number;
  createdAt: string;
}

interface MultisigWallet {
  id: string;
  name: string;
  address: string;
  threshold: number;
  createdAt: string;
}

interface MultisigOwner {
  id: string;
  walletId: string;
  address: string;
}

interface MultisigTransaction {
  id: string;
  walletId: string;
  toAddress: string;
  amount: string;
  description: string;
  status: string;
  signaturesRequired: number;
  signaturesCollected: number;
  createdAt: string;
}

// In-memory data store
class Database {
  dcaBots: DCABot[] = [];
  dcaExecutions: DCAExecution[] = [];
  cards: Card[] = [];
  cardTransactions: CardTransaction[] = [];
  daos: DAO[] = [];
  daoMembers: DAOMember[] = [];
  proposals: Proposal[] = [];
  votes: Vote[] = [];
  multisigWallets: MultisigWallet[] = [];
  multisigOwners: MultisigOwner[] = [];
  multisigTransactions: MultisigTransaction[] = [];

  constructor() {
    this.seedData();
  }

  private seedData() {
    const now = new Date().toISOString();
    const testAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const testUserId = 'user_test_001';

    // Seed DCA Bots
    this.dcaBots = [
      {
        id: 'dca_001',
        userId: testUserId,
        name: 'ETH Weekly DCA',
        sourceAsset: 'USDC',
        targetAsset: 'ETH',
        amount: 100,
        frequency: 'weekly',
        status: 'active',
        nextExecution: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        totalInvested: 2400,
        averagePrice: 2150,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'dca_002',
        userId: testUserId,
        name: 'BTC Monthly Savings',
        sourceAsset: 'USDC',
        targetAsset: 'BTC',
        amount: 500,
        frequency: 'monthly',
        status: 'active',
        nextExecution: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        totalInvested: 6000,
        averagePrice: 41500,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'dca_003',
        userId: testUserId,
        name: 'ÉTR Daily Accumulator',
        sourceAsset: 'EDSC',
        targetAsset: 'ÉTR',
        amount: 50,
        frequency: 'daily',
        status: 'paused',
        nextExecution: now,
        totalInvested: 1500,
        averagePrice: 0.98,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed DCA Executions
    this.dcaExecutions = [
      {
        id: 'exec_001',
        botId: 'dca_001',
        amount: 100,
        price: 2180,
        tokensReceived: 0.0459,
        status: 'completed',
        executedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'exec_002',
        botId: 'dca_001',
        amount: 100,
        price: 2220,
        tokensReceived: 0.0450,
        status: 'completed',
        executedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'exec_003',
        botId: 'dca_002',
        amount: 500,
        price: 42500,
        tokensReceived: 0.01176,
        status: 'completed',
        executedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed Cards
    this.cards = [
      {
        id: 'card_001',
        userId: testUserId,
        cardNumber: '4532',
        cardholderName: 'ALICE VALIDATOR',
        expiryDate: '12/27',
        cvv: '123',
        status: 'active',
        cardType: 'virtual',
        cryptoAsset: 'ETH',
        collateralAmount: 5,
        collateralValueUSD: 11000,
        availableAmount: 5500,
        ltv: 0.5,
        liquidationThreshold: 1760,
        dailyLimit: 2500,
        monthlyLimit: 25000,
        perTransactionLimit: 1000,
        dailySpent: 150,
        monthlySpent: 3200,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'card_002',
        userId: testUserId,
        cardNumber: '8901',
        cardholderName: 'ALICE VALIDATOR',
        expiryDate: '06/26',
        cvv: '456',
        status: 'frozen',
        cardType: 'virtual',
        cryptoAsset: 'BTC',
        collateralAmount: 0.25,
        collateralValueUSD: 10750,
        availableAmount: 5375,
        ltv: 0.5,
        liquidationThreshold: 34400,
        dailyLimit: 5000,
        monthlyLimit: 50000,
        perTransactionLimit: 2500,
        dailySpent: 0,
        monthlySpent: 1500,
        createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed Card Transactions
    this.cardTransactions = [
      {
        id: 'tx_001',
        cardId: 'card_001',
        merchantName: 'Amazon',
        merchantCategory: 'retail',
        amount: 89.99,
        currency: 'USD',
        status: 'completed',
        nfcTransaction: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'tx_002',
        cardId: 'card_001',
        merchantName: 'Starbucks',
        merchantCategory: 'food_beverage',
        amount: 6.50,
        currency: 'USD',
        status: 'completed',
        nfcTransaction: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'tx_003',
        cardId: 'card_001',
        merchantName: 'Shell Gas Station',
        merchantCategory: 'fuel',
        amount: 53.47,
        currency: 'USD',
        status: 'completed',
        nfcTransaction: true,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed DAOs
    this.daos = [
      {
        id: 'dao_001',
        name: 'Étrid Protocol DAO',
        description: 'Core governance for the Étrid protocol',
        governanceToken: 'ÉTR',
        treasury: 5000000,
        members: 1250,
        votingThreshold: 100000,
        proposalDeposit: 1000,
        votingPeriod: 604800
      },
      {
        id: 'dao_002',
        name: 'DeFi Guild',
        description: 'Community-driven DeFi initiatives',
        governanceToken: 'GUILD',
        treasury: 250000,
        members: 450,
        votingThreshold: 10000,
        proposalDeposit: 100,
        votingPeriod: 259200
      }
    ];

    // Seed DAO Members
    this.daoMembers = [
      { id: 'member_001', daoId: 'dao_001', address: testAddress, votingPower: 50000, joinedAt: now },
      { id: 'member_002', daoId: 'dao_002', address: testAddress, votingPower: 5000, joinedAt: now }
    ];

    // Seed Proposals
    this.proposals = [
      {
        id: 'prop_001',
        daoId: 'dao_001',
        title: 'Increase Validator Rewards by 10%',
        description: 'Proposal to increase block rewards for validators to incentivize network security.',
        proposer: testAddress,
        status: 'active',
        votesFor: 75000,
        votesAgainst: 15000,
        votesAbstain: 5000,
        threshold: 100000,
        startBlock: 1000000,
        endBlock: 1100000,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'prop_002',
        daoId: 'dao_001',
        title: 'Fund Community Development Program',
        description: 'Allocate 100,000 ÉTR from treasury for developer grants.',
        proposer: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
        status: 'active',
        votesFor: 45000,
        votesAgainst: 30000,
        votesAbstain: 10000,
        threshold: 100000,
        startBlock: 1000050,
        endBlock: 1100050,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'prop_003',
        daoId: 'dao_001',
        title: 'Enable Cross-Chain Bridge',
        description: 'Activate the Ethereum-Étrid bridge for asset transfers.',
        proposer: testAddress,
        status: 'passed',
        votesFor: 120000,
        votesAgainst: 20000,
        votesAbstain: 8000,
        threshold: 100000,
        startBlock: 900000,
        endBlock: 1000000,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Seed Multisig Wallets
    this.multisigWallets = [
      {
        id: 'msig_001',
        name: 'Team Treasury',
        address: '5TEAM1234567890abcdefghijklmnopqrstuvwxyz12',
        threshold: 2,
        createdAt: now
      }
    ];

    this.multisigOwners = [
      { id: 'owner_001', walletId: 'msig_001', address: testAddress },
      { id: 'owner_002', walletId: 'msig_001', address: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y' },
      { id: 'owner_003', walletId: 'msig_001', address: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy' }
    ];

    this.multisigTransactions = [
      {
        id: 'mtx_001',
        walletId: 'msig_001',
        toAddress: '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw',
        amount: '10000000000000000000',
        description: 'Monthly operations payment',
        status: 'pending',
        signaturesRequired: 2,
        signaturesCollected: 1,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    console.log('Database seeded with test data');
  }
}

export const db = new Database();
