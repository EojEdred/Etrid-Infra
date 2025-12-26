import { Router, Request, Response } from 'express';
import { db } from '../services/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Get multisig wallets for a user
router.get('/wallets', (req: Request, res: Response) => {
  const address = req.query.address as string || '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

  // Get wallet IDs where user is an owner
  const userWalletIds = db.multisigOwners
    .filter(o => o.address === address)
    .map(o => o.walletId);

  const wallets = db.multisigWallets.filter(w => userWalletIds.includes(w.id));

  // Get owners for each wallet
  const walletsWithOwners = wallets.map(wallet => {
    const owners = db.multisigOwners
      .filter(o => o.walletId === wallet.id)
      .map(o => o.address);

    return {
      ...wallet,
      owners
    };
  });

  res.json({ wallets: walletsWithOwners });
});

// Get pending transactions for a wallet
router.get('/wallets/:walletId/transactions', (req: Request, res: Response) => {
  const status = req.query.status as string;

  let transactions = db.multisigTransactions.filter(tx => tx.walletId === req.params.walletId);

  if (status) {
    transactions = transactions.filter(tx => tx.status === status);
  }

  transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formattedTransactions = transactions.map(tx => ({
    id: tx.id,
    walletId: tx.walletId,
    to: tx.toAddress,
    amount: tx.amount,
    description: tx.description,
    status: tx.status,
    signaturesRequired: tx.signaturesRequired,
    signaturesCollected: tx.signaturesCollected,
    createdAt: tx.createdAt
  }));

  res.json({ transactions: formattedTransactions });
});

// Create a multisig wallet
router.post('/wallets', (req: Request, res: Response) => {
  const { name, owners, threshold } = req.body;

  if (!name || !owners || !threshold || owners.length < threshold) {
    return res.status(400).json({ error: 'Invalid wallet configuration' });
  }

  const walletId = `msig_${uuidv4().slice(0, 8)}`;
  const address = `5${uuidv4().replace(/-/g, '').slice(0, 47)}`;

  const wallet = {
    id: walletId,
    name,
    address,
    threshold: Number(threshold),
    createdAt: new Date().toISOString()
  };

  db.multisigWallets.push(wallet);

  // Add owners
  for (const owner of owners) {
    db.multisigOwners.push({
      id: `owner_${uuidv4().slice(0, 8)}`,
      walletId,
      address: owner
    });
  }

  res.status(201).json({ ...wallet, owners });
});

// Create a transaction
router.post('/wallets/:walletId/transactions', (req: Request, res: Response) => {
  const { to, amount, description, initiator } = req.body;
  const walletId = req.params.walletId;

  const wallet = db.multisigWallets.find(w => w.id === walletId);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const transaction = {
    id: `mtx_${uuidv4().slice(0, 8)}`,
    walletId,
    toAddress: to,
    amount: String(amount),
    description: description || '',
    status: 'pending',
    signaturesRequired: wallet.threshold,
    signaturesCollected: 1, // Initiator signs automatically
    createdAt: new Date().toISOString()
  };

  db.multisigTransactions.push(transaction);
  res.status(201).json(transaction);
});

// Sign a transaction
router.post('/transactions/:txId/sign', (req: Request, res: Response) => {
  const txId = req.params.txId;

  const tx = db.multisigTransactions.find(t => t.id === txId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  if (tx.status !== 'pending') {
    return res.status(400).json({ error: 'Transaction is not pending' });
  }

  // Increment signatures
  tx.signaturesCollected += 1;

  if (tx.signaturesCollected >= tx.signaturesRequired) {
    tx.status = 'executed';
  }

  res.json(tx);
});

// Reject a transaction
router.post('/transactions/:txId/reject', (req: Request, res: Response) => {
  const txId = req.params.txId;

  const tx = db.multisigTransactions.find(t => t.id === txId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  tx.status = 'rejected';
  res.json({ success: true, message: 'Transaction rejected' });
});

export default router;
