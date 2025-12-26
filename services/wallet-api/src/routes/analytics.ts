import { Router, Request, Response } from 'express';

const router = Router();

// Get portfolio snapshot
router.get('/portfolio', (req: Request, res: Response) => {
  const userId = req.query.userId as string || 'user_test_001';

  res.json({
    id: `snap_${Date.now()}`,
    userId,
    totalValue: 125000 + (Math.random() - 0.5) * 5000,
    change24h: 5.2 + (Math.random() - 0.5) * 2,
    assets: [
      {
        symbol: 'ÉTR',
        name: 'Étrid',
        amount: 50000,
        valueUSD: 50500,
        price: 1.01,
        change24h: 2.5,
        percentage: 40.4
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 15,
        valueUSD: 33000,
        price: 2200,
        change24h: 3.2,
        percentage: 26.4
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        amount: 0.5,
        valueUSD: 21500,
        price: 43000,
        change24h: 1.8,
        percentage: 17.2
      },
      {
        symbol: 'EDSC',
        name: 'EDSC Stablecoin',
        amount: 10000,
        valueUSD: 10030,
        price: 1.003,
        change24h: 0.1,
        percentage: 8.0
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        amount: 10000,
        valueUSD: 10000,
        price: 1.0,
        change24h: 0,
        percentage: 8.0
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Get performance data
router.get('/performance', (req: Request, res: Response) => {
  const period = req.query.period as string || '1M';

  const dataPoints = generatePerformanceData(period);

  res.json({
    period,
    startValue: 100000,
    currentValue: 125000,
    roi: 25.0,
    dataPoints,
    riskMetrics: {
      volatility: 0.15,
      sharpeRatio: 1.8,
      maxDrawdown: 0.12,
      beta: 0.85
    }
  });
});

// Get allocation breakdown
router.get('/allocation', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  res.json({
    allocations: [
      { symbol: 'ÉTR', percentage: 40.4, valueUSD: 50500, change24h: 2.5 },
      { symbol: 'ETH', percentage: 26.4, valueUSD: 33000, change24h: 3.2 },
      { symbol: 'BTC', percentage: 17.2, valueUSD: 21500, change24h: 1.8 },
      { symbol: 'EDSC', percentage: 8.0, valueUSD: 10030, change24h: 0.1 },
      { symbol: 'USDC', percentage: 8.0, valueUSD: 10000, change24h: 0.0 }
    ]
  });
});

// Get tax report
router.get('/tax', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  res.json({
    year,
    totalGains: 15000,
    totalLosses: 2000,
    shortTermGains: 8000,
    longTermGains: 7000,
    transactions: [
      {
        date: new Date(year, 3, 15).toISOString(),
        type: 'sell',
        asset: 'ETH',
        amount: 2.5,
        costBasis: 4500,
        proceeds: 5500,
        gainLoss: 1000
      },
      {
        date: new Date(year, 6, 20).toISOString(),
        type: 'sell',
        asset: 'BTC',
        amount: 0.1,
        costBasis: 3800,
        proceeds: 4300,
        gainLoss: 500
      }
    ]
  });
});

// Get insights
router.get('/insights', (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  res.json({
    insights: [
      {
        id: 'insight_001',
        type: 'opportunity',
        title: 'DCA Opportunity',
        description: 'ETH price is 10% below your average buy price. Consider increasing your DCA amount.',
        priority: 'medium',
        action: 'dca_adjust'
      },
      {
        id: 'insight_002',
        type: 'risk',
        title: 'Portfolio Concentration',
        description: 'ÉTR makes up 40% of your portfolio. Consider diversifying.',
        priority: 'low',
        action: 'rebalance'
      },
      {
        id: 'insight_003',
        type: 'performance',
        title: 'Strong Month',
        description: 'Your portfolio is up 5.2% this month, outperforming the market by 2%.',
        priority: 'info',
        action: null
      }
    ]
  });
});

function generatePerformanceData(period: string): Array<{ date: string; value: number }> {
  const points: Array<{ date: string; value: number }> = [];
  const now = new Date();
  let days = 30;

  switch (period) {
    case '1W': days = 7; break;
    case '1M': days = 30; break;
    case '3M': days = 90; break;
    case '6M': days = 180; break;
    case '1Y': days = 365; break;
    case 'ALL': days = 730; break;
  }

  let value = 100000;
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value = value * (1 + (Math.random() - 0.48) * 0.02); // Slight upward bias
    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 100) / 100
    });
  }

  return points;
}

export default router;
