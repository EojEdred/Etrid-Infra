/**
 * AU Lightning Bloc Waitlist API
 * Cloudflare Worker for managing virtual card waitlist signups
 *
 * Deploy with: wrangler deploy
 * Requires D1 database binding: WAITLIST_DB
 */

export interface Env {
  WAITLIST_DB: D1Database;
}

interface WaitlistEntry {
  id: string;
  email: string;
  wallet_address: string;
  card_type: string;
  spending_tier: string;
  product: string;
  position: number;
  created_at: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Initialize database schema if needed
      await initDB(env.WAITLIST_DB);

      // Route handling
      if (path === '/v1/waitlist/register' && request.method === 'POST') {
        return handleRegister(request, env);
      }

      if (path === '/v1/waitlist/position' && request.method === 'GET') {
        return handleGetPosition(request, env);
      }

      if (path === '/v1/waitlist/stats' && request.method === 'GET') {
        return handleGetStats(env);
      }

      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: 'au-lightning-bloc-waitlist' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function initDB(db: D1Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      card_type TEXT NOT NULL,
      spending_tier TEXT NOT NULL,
      product TEXT DEFAULT 'au_lightning_bloc',
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      notified INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_email ON waitlist(email);
    CREATE INDEX IF NOT EXISTS idx_position ON waitlist(position);
  `);
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    email: string;
    wallet_address: string;
    card_type: string;
    spending_tier: string;
    product?: string;
  };

  // Validate required fields
  if (!body.email || !body.wallet_address || !body.card_type || !body.spending_tier) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if already registered
  const existing = await env.WAITLIST_DB.prepare(
    'SELECT id, position FROM waitlist WHERE email = ?'
  ).bind(body.email).first<{ id: string; position: number }>();

  if (existing) {
    return new Response(JSON.stringify({
      success: true,
      position: existing.position,
      id: existing.id,
      message: 'Already registered',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get current max position
  const maxPos = await env.WAITLIST_DB.prepare(
    'SELECT MAX(position) as max_pos FROM waitlist'
  ).first<{ max_pos: number | null }>();

  const position = (maxPos?.max_pos || 0) + 1;
  const id = crypto.randomUUID();

  // Insert new entry
  await env.WAITLIST_DB.prepare(`
    INSERT INTO waitlist (id, email, wallet_address, card_type, spending_tier, product, position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.email.toLowerCase(),
    body.wallet_address,
    body.card_type,
    body.spending_tier,
    body.product || 'au_lightning_bloc',
    position,
    new Date().toISOString()
  ).run();

  return new Response(JSON.stringify({
    success: true,
    position: position,
    id: id,
    message: 'Successfully registered for AU Lightning Bloc waitlist',
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetPosition(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email parameter required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const entry = await env.WAITLIST_DB.prepare(
    'SELECT position, created_at FROM waitlist WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ position: number; created_at: string }>();

  if (!entry) {
    return new Response(JSON.stringify({ error: 'Email not found in waitlist' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get total count
  const total = await env.WAITLIST_DB.prepare(
    'SELECT COUNT(*) as count FROM waitlist'
  ).first<{ count: number }>();

  return new Response(JSON.stringify({
    position: entry.position,
    total: total?.count || 0,
    registered_at: entry.created_at,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetStats(env: Env): Promise<Response> {
  const total = await env.WAITLIST_DB.prepare(
    'SELECT COUNT(*) as count FROM waitlist'
  ).first<{ count: number }>();

  const byCardType = await env.WAITLIST_DB.prepare(`
    SELECT card_type, COUNT(*) as count
    FROM waitlist
    GROUP BY card_type
  `).all<{ card_type: string; count: number }>();

  const bySpendingTier = await env.WAITLIST_DB.prepare(`
    SELECT spending_tier, COUNT(*) as count
    FROM waitlist
    GROUP BY spending_tier
  `).all<{ spending_tier: string; count: number }>();

  const recentSignups = await env.WAITLIST_DB.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM waitlist
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all<{ date: string; count: number }>();

  return new Response(JSON.stringify({
    total: total?.count || 0,
    by_card_type: byCardType.results,
    by_spending_tier: bySpendingTier.results,
    recent_signups: recentSignups.results,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
