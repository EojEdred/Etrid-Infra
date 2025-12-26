import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Routes
import walletRoutes from './routes/wallet';
import dcaRoutes from './routes/dca';
import cardRoutes from './routes/card';
import daoRoutes from './routes/dao';
import analyticsRoutes from './routes/analytics';
import multisigRoutes from './routes/multisig';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes - all prefixed with /api/v1
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/dca', dcaRoutes);
app.use('/api/v1/card', cardRoutes);
app.use('/api/v1/dao', daoRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/multisig', multisigRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Etrid Wallet API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
