import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all cards for a user
router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId as string || 'user_test_001';

  const cards = db.cards.filter(card => card.userId === userId);

  const formattedCards = cards.map(card => ({
    id: card.id,
    userId: card.userId,
    cardNumber: card.cardNumber,
    cardholderName: card.cardholderName,
    expiryDate: card.expiryDate,
    cvv: card.cvv,
    status: card.status,
    cardType: card.cardType,
    collateral: {
      cryptoAsset: card.cryptoAsset,
      collateralAmount: card.collateralAmount,
      collateralValueUSD: card.collateralValueUSD,
      availableAmount: card.availableAmount,
      ltv: card.ltv,
      liquidationThreshold: card.liquidationThreshold
    },
    limits: {
      dailyLimit: card.dailyLimit,
      monthlyLimit: card.monthlyLimit,
      perTransactionLimit: card.perTransactionLimit,
      dailySpent: card.dailySpent,
      monthlySpent: card.monthlySpent
    },
    createdAt: card.createdAt
  }));

  res.json({ cards: formattedCards });
});

// Create a new card
router.post('/', (req: Request, res: Response) => {
  const { userId, cardholderName, cryptoAsset, collateralAmount } = req.body;

  if (!userId || !cardholderName || !cryptoAsset || !collateralAmount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const collateralValueUSD = collateralAmount * getPriceForAsset(cryptoAsset);
  const availableAmount = collateralValueUSD * 0.5;
  const liquidationThreshold = getPriceForAsset(cryptoAsset) * 0.8;

  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 3);

  const newCard = {
    id: `card_${uuidv4().slice(0, 8)}`,
    userId: userId || 'user_test_001',
    cardNumber: Math.floor(1000 + Math.random() * 9000).toString(),
    cardholderName,
    expiryDate: `${(expiryDate.getMonth() + 1).toString().padStart(2, '0')}/${expiryDate.getFullYear().toString().slice(2)}`,
    cvv: Math.floor(100 + Math.random() * 900).toString(),
    status: 'active',
    cardType: 'virtual',
    cryptoAsset,
    collateralAmount: Number(collateralAmount),
    collateralValueUSD,
    availableAmount,
    ltv: 0.5,
    liquidationThreshold,
    dailyLimit: 2500,
    monthlyLimit: 25000,
    perTransactionLimit: 1000,
    dailySpent: 0,
    monthlySpent: 0,
    createdAt: new Date().toISOString()
  };

  db.cards.push(newCard);
  res.status(201).json(newCard);
});

// Freeze card
router.post('/:id/freeze', (req: Request, res: Response) => {
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  card.status = 'frozen';
  res.json(card);
});

// Unfreeze card
router.post('/:id/unfreeze', (req: Request, res: Response) => {
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  card.status = 'active';
  res.json(card);
});

// Block card
router.post('/:id/block', (req: Request, res: Response) => {
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  card.status = 'blocked';
  res.json(card);
});

// Get card transactions
router.get('/:id/transactions', (req: Request, res: Response) => {
  const transactions = db.cardTransactions
    .filter(tx => tx.cardId === req.params.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)
    .map(tx => ({
      id: tx.id,
      cardId: tx.cardId,
      merchantName: tx.merchantName,
      merchantCategory: tx.merchantCategory,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      nfcTransaction: tx.nfcTransaction,
      timestamp: tx.createdAt
    }));

  res.json({ transactions });
});

// Process NFC payment
router.post('/:id/pay', (req: Request, res: Response) => {
  const { merchantName, merchantCategory, amount, currency } = req.body;
  const card = db.cards.find(c => c.id === req.params.id);

  if (!card) return res.status(404).json({ error: 'Card not found' });

  if (card.status !== 'active') {
    return res.json({
      success: false,
      message: `Card is ${card.status}`,
      declineReason: `card_${card.status}`
    });
  }

  if (amount > card.availableAmount) {
    return res.json({
      success: false,
      message: 'Insufficient funds',
      declineReason: 'insufficient_funds'
    });
  }

  if (amount > card.perTransactionLimit) {
    return res.json({
      success: false,
      message: 'Transaction limit exceeded',
      declineReason: 'limit_exceeded'
    });
  }

  // Create transaction
  const tx = {
    id: `tx_${uuidv4().slice(0, 8)}`,
    cardId: card.id,
    merchantName: merchantName || 'Unknown Merchant',
    merchantCategory: merchantCategory || 'general',
    amount: Number(amount),
    currency: currency || 'USD',
    status: 'completed',
    nfcTransaction: true,
    createdAt: new Date().toISOString()
  };

  db.cardTransactions.push(tx);

  // Update card spending
  card.availableAmount -= amount;
  card.dailySpent += amount;
  card.monthlySpent += amount;

  res.json({
    success: true,
    transactionId: tx.id,
    message: 'Payment successful',
    newBalance: card.availableAmount
  });
});

// Add collateral
router.post('/:id/collateral/add', (req: Request, res: Response) => {
  const { amount } = req.body;
  const card = db.cards.find(c => c.id === req.params.id);

  if (!card) return res.status(404).json({ error: 'Card not found' });

  card.collateralAmount += Number(amount);
  card.collateralValueUSD = card.collateralAmount * getPriceForAsset(card.cryptoAsset);
  card.availableAmount = card.collateralValueUSD * card.ltv;

  res.json({
    success: true,
    newCollateralAmount: card.collateralAmount,
    newAvailableAmount: card.availableAmount
  });
});

// Withdraw collateral
router.post('/:id/collateral/withdraw', (req: Request, res: Response) => {
  const { amount } = req.body;
  const card = db.cards.find(c => c.id === req.params.id);

  if (!card) return res.status(404).json({ error: 'Card not found' });

  if (amount > card.collateralAmount) {
    return res.status(400).json({ error: 'Insufficient collateral' });
  }

  card.collateralAmount -= Number(amount);
  card.collateralValueUSD = card.collateralAmount * getPriceForAsset(card.cryptoAsset);
  card.availableAmount = Math.min(card.availableAmount, card.collateralValueUSD * card.ltv);

  res.json({
    success: true,
    newCollateralAmount: card.collateralAmount,
    newAvailableAmount: card.availableAmount
  });
});

function getPriceForAsset(asset: string): number {
  const prices: { [key: string]: number } = {
    'ETH': 2200,
    'BTC': 43000,
    'USDC': 1,
    'ÉTR': 1.01,
    'EDSC': 1.003
  };
  return prices[asset] || 1;
}

export default router;
