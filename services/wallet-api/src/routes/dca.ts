import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get all DCA bots for a user
router.get('/bots', (req: Request, res: Response) => {
  const userId = req.query.userId as string || 'user_test_001';

  const bots = db.dcaBots.filter(bot => bot.userId === userId);

  const formattedBots = bots.map(bot => ({
    id: bot.id,
    userId: bot.userId,
    name: bot.name,
    fromAsset: bot.sourceAsset,
    toAsset: bot.targetAsset,
    frequency: bot.frequency,
    amount: bot.amount,
    isActive: bot.status === 'active',
    totalInvested: bot.totalInvested,
    averagePrice: bot.averagePrice,
    nextRun: bot.nextExecution,
    createdAt: bot.createdAt,
    pair: `${bot.sourceAsset} → ${bot.targetAsset}`
  }));

  res.json({ bots: formattedBots });
});

// Get a specific bot
router.get('/bots/:id', (req: Request, res: Response) => {
  const bot = db.dcaBots.find(b => b.id === req.params.id);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  res.json({
    id: bot.id,
    userId: bot.userId,
    name: bot.name,
    fromAsset: bot.sourceAsset,
    toAsset: bot.targetAsset,
    frequency: bot.frequency,
    amount: bot.amount,
    isActive: bot.status === 'active',
    totalInvested: bot.totalInvested,
    averagePrice: bot.averagePrice,
    nextRun: bot.nextExecution,
    createdAt: bot.createdAt
  });
});

// Create a new DCA bot
router.post('/bots', (req: Request, res: Response) => {
  const { userId, name, fromAsset, toAsset, frequency, amount } = req.body;

  if (!userId || !name || !fromAsset || !toAsset || !frequency || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newBot = {
    id: `dca_${uuidv4().slice(0, 8)}`,
    userId: userId || 'user_test_001',
    name,
    sourceAsset: fromAsset,
    targetAsset: toAsset,
    amount: Number(amount),
    frequency,
    status: 'active',
    nextExecution: calculateNextRun(frequency).toISOString(),
    totalInvested: 0,
    averagePrice: 0,
    createdAt: new Date().toISOString()
  };

  db.dcaBots.push(newBot);

  res.status(201).json({
    id: newBot.id,
    userId: newBot.userId,
    name: newBot.name,
    fromAsset: newBot.sourceAsset,
    toAsset: newBot.targetAsset,
    frequency: newBot.frequency,
    amount: newBot.amount,
    isActive: true,
    totalInvested: 0,
    averagePrice: 0,
    nextRun: newBot.nextExecution,
    createdAt: newBot.createdAt
  });
});

// Toggle bot active status
router.patch('/bots/:id/toggle', (req: Request, res: Response) => {
  const { isActive } = req.body;
  const bot = db.dcaBots.find(b => b.id === req.params.id);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  bot.status = isActive ? 'active' : 'paused';

  res.json({
    id: bot.id,
    userId: bot.userId,
    name: bot.name,
    fromAsset: bot.sourceAsset,
    toAsset: bot.targetAsset,
    frequency: bot.frequency,
    amount: bot.amount,
    isActive: bot.status === 'active',
    totalInvested: bot.totalInvested,
    averagePrice: bot.averagePrice,
    nextRun: bot.nextExecution
  });
});

// Execute a bot manually
router.post('/bots/:id/execute', (req: Request, res: Response) => {
  const bot = db.dcaBots.find(b => b.id === req.params.id);

  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  // Simulate execution
  const currentPrice = getSimulatedPrice(bot.targetAsset);
  const purchasedAmount = bot.amount / currentPrice;

  // Create execution record
  const execution = {
    id: `exec_${uuidv4().slice(0, 8)}`,
    botId: bot.id,
    amount: bot.amount,
    price: currentPrice,
    tokensReceived: purchasedAmount,
    status: 'completed',
    executedAt: new Date().toISOString()
  };

  db.dcaExecutions.push(execution);

  // Update bot statistics
  bot.totalInvested += bot.amount;
  const totalPurchased = db.dcaExecutions
    .filter(e => e.botId === bot.id)
    .reduce((sum, e) => sum + e.tokensReceived, 0);
  bot.averagePrice = bot.totalInvested / totalPurchased;
  bot.nextExecution = calculateNextRun(bot.frequency).toISOString();

  res.json({ execution, message: 'Bot executed successfully' });
});

// Get execution history for a bot
router.get('/bots/:id/executions', (req: Request, res: Response) => {
  const executions = db.dcaExecutions
    .filter(e => e.botId === req.params.id)
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
    .slice(0, 50);

  res.json({ executions });
});

// Delete a bot
router.delete('/bots/:id', (req: Request, res: Response) => {
  const index = db.dcaBots.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  // Remove executions
  db.dcaExecutions = db.dcaExecutions.filter(e => e.botId !== req.params.id);
  // Remove bot
  db.dcaBots.splice(index, 1);

  res.json({ success: true });
});

// Helper functions
function calculateNextRun(frequency: string): Date {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

function getSimulatedPrice(asset: string): number {
  const prices: { [key: string]: number } = {
    'ÉTR': 1.01 + (Math.random() - 0.5) * 0.1,
    'EDSC': 1.003 + (Math.random() - 0.5) * 0.05,
    'ETH': 2200 + (Math.random() - 0.5) * 200,
    'BTC': 43000 + (Math.random() - 0.5) * 2000,
    'USDC': 1.0,
  };
  return prices[asset] || 1.0;
}

export default router;
