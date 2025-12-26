import { Router, Request, Response } from 'express';
import { db } from '../services/database';

const router = Router();

// Get wallet balance
router.get('/balance/:address', (req: Request, res: Response) => {
  // In production, this would query the blockchain
  // For now, return simulated balance
  const address = req.params.address;

  res.json({
    free: '10000000000000000000', // 10 ÉTR in smallest unit
    reserved: '1000000000000000000',
    frozen: '500000000000000000',
    address
  });
});

// Get transaction history
router.get('/transactions/:address', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;

  // Simulated transaction history
  const transactions = [
    {
      hash: '0x1234...abcd',
      from: req.params.address,
      to: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
      amount: '1000000000000000000',
      timestamp: Date.now() - 3600000,
      status: 'confirmed',
      blockNumber: 1000050
    },
    {
      hash: '0x5678...efgh',
      from: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
      to: req.params.address,
      amount: '5000000000000000000',
      timestamp: Date.now() - 86400000,
      status: 'confirmed',
      blockNumber: 999900
    }
  ];

  res.json({ transactions });
});

// Transfer tokens
router.post('/transfer', (req: Request, res: Response) => {
  const { from, to, amount, memo } = req.body;

  if (!from || !to || !amount) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // In production, this would submit to the blockchain
  const hash = `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;

  res.json({
    hash,
    blockNumber: Math.floor(Math.random() * 100) + 1000000
  });
});

// Get chain info
router.get('/chain/info', (req: Request, res: Response) => {
  res.json({
    name: 'Étrid PrimeArc',
    version: '1.0.0',
    blockNumber: 1000100,
    blockTime: 6
  });
});

// Staking endpoints
router.post('/stake', (req: Request, res: Response) => {
  const { address, amount, validator } = req.body;
  res.json({ success: true, message: 'Staking initiated' });
});

router.post('/unstake', (req: Request, res: Response) => {
  const { address, amount } = req.body;
  res.json({ success: true, message: 'Unstaking initiated' });
});

export default router;
