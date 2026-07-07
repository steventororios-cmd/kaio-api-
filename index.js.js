/**
 * KAIO-API — Backend seguro para Google Ads OAuth + Data Proxy
 * Despliega en Railway (railway.app) o Render (render.com)
 *
 * Variables de entorno requeridas (configúralas en Railway/Render):
 *   GOOGLE_CLIENT_ID      → Client ID de tu proyecto en Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  → Client Secret (¡nunca en el frontend!)
 *   GOOGLE_DEVELOPER_TOKEN → Developer token de Google Ads
 *   REDIRECT_URI          → https://TU-APP.railway.app/auth/google/callback
 *   FRONTEND_URL          → https://dashkaio.netlify.app
 *   SESSION_SECRET        → cualquier string largo aleatorio
 *   PORT                  → 3000 (Railway lo pone automáticamente)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Token store (en memoria; en producción usa Redis o DB) ──
// Para un solo usuario esto es suficiente; para multi-usuario
// necesitarías una DB como PlanetScale o Supabase.
const tokenStore = {};

// ── CORS: solo permite peticiones desde tu frontend ──
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://dashkaio.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8080',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'KAIO-API',
    version: '1.0.0',
    google_ads: !!process.env.GOOGLE_CLIENT_ID,
  });
});

// ── STEP 1: Generate Google OAuth URL ────────────────────────
app.get('/auth/google/url', (req, res) => {
  const { userId = 'default' } = req.query;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// ── STEP 2: OAuth Callback — exchange code for tokens ────────
app.get('/auth/google/callback', async (req, res) => {
  const { code, state: userId = 'default', error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}?gads_error=${encodeURIComponent(error)}`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Store tokens server-side (safe — never sent to browser)
    tokenStore[userId] = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in - 60) * 1000,
    };

    // Redirect back to frontend with success signal
    res.redirect(`${process.env.FRONTEND_URL}?gads_connected=1&uid=${encodeURIComponent(userId)}`);
  } catch (e) {
    console.error('OAuth callback error:', e.message);
    res.redirect(`${process.env.FRONTEND_URL}?gads_error=${encodeURIComponent(e.message)}`);
  }
});

// ── Token refresh helper ──────────────────────────────────────
async function getValidToken(userId = 'default') {
  const stored = tokenStore[userId];
  if (!stored) throw new Error('NOT_AUTHENTICATED');

  if (Date.now() < stored.expiry) return stored.access_token;

  // Refresh
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: stored.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const t = await r.json();
  if (t.error) throw new Error('TOKEN_REFRESH_FAILED: ' + t.error);

  stored.access_token = t.access_token;
  stored.expiry = Date.now() + (t.expires_in - 60) * 1000;
  return stored.access_token;
}

// ── Auth status ───────────────────────────────────────────────
app.get('/auth/status', (req, res) => {
  const { uid = 'default' } = req.query;
  const stored = tokenStore[uid];
  res.json({ connected: !!stored, expired: stored ? Date.now() >= stored.expiry : false });
});

// ── Disconnect ────────────────────────────────────────────────
app.post('/auth/disconnect', (req, res) => {
  const { uid = 'default' } = req.body;
  delete tokenStore[uid];
  res.json({ ok: true });
});

// ── Google Ads API helper ─────────────────────────────────────
async function gadsQuery(accessToken, customerId, query) {
  const url = `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
      'login-customer-id': customerId, // MCC customer id
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const chunks = await res.json();
  // searchStream returns array of result chunks
  const results = [];
  (Array.isArray(chunks) ? chunks : [chunks]).forEach(chunk => {
    (chunk.results || []).forEach(r => results.push(r));
  });
  return results;
}

// ── GET /gads/accounts — list MCC child accounts ─────────────
app.get('/gads/accounts', async (req, res) => {
  const { uid = 'default', mcc_id } = req.query;
  if (!mcc_id) return res.status(400).json({ error: 'mcc_id required' });

  try {
    const token = await getValidToken(uid);
    const results = await gadsQuery(token, mcc_id.replace(/-/g, ''), `
      SELECT
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.status,
        customer_client.level
      FROM customer_client
      WHERE customer_client.level = 1
    `);

    const accounts = results.map(r => ({
      id: r.customerClient?.clientCustomer?.replace('customers/', ''),
      name: r.customerClient?.descriptiveName || 'Sin nombre',
      currency: r.customerClient?.currencyCode || 'USD',
      status: r.customerClient?.status || 'UNKNOWN',
    }));

    res.json({ accounts });
  } catch (e) {
    if (e.message === 'NOT_AUTHENTICATED') return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /gads/campaigns — campaign metrics ────────────────────
app.get('/gads/campaigns', async (req, res) => {
  const { uid = 'default', customer_id, since, until } = req.query;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  const dateRange = since && until
    ? `segments.date BETWEEN '${since}' AND '${until}'`
    : `segments.date DURING LAST_30_DAYS`;

  try {
    const token = await getValidToken(uid);
    const results = await gadsQuery(token, customer_id.replace(/-/g, ''), `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion,
        metrics.all_conversions,
        metrics.view_through_conversions,
        metrics.video_views,
        metrics.average_cpv
      FROM campaign
      WHERE ${dateRange}
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 500
    `);

    const campaigns = results.map(r => {
      const m = r.metrics || {};
      const spend = (m.costMicros || 0) / 1e6;
      const conv = parseFloat(m.conversions || 0);
      return {
        id: r.campaign?.id,
        name: r.campaign?.name || '—',
        status: r.campaign?.status || '—',
        channel: r.campaign?.advertisingChannelType || '—',
        biddingStrategy: r.campaign?.biddingStrategyType || '—',
        spend: spend.toFixed(2),
        impressions: parseInt(m.impressions || 0),
        clicks: parseInt(m.clicks || 0),
        ctr: parseFloat((m.ctr || 0) * 100).toFixed(2),
        cpc: parseFloat((m.averageCpc || 0) / 1e6).toFixed(2),
        cpm: parseFloat((m.averageCpm || 0) / 1e6).toFixed(2),
        conversions: conv.toFixed(0),
        convValue: parseFloat(m.conversionsValue || 0).toFixed(2),
        cpa: conv > 0 ? (spend / conv).toFixed(2) : '0',
        roas: spend > 0 ? (parseFloat(m.conversionsValue || 0) / spend).toFixed(2) : '0',
        videoViews: parseInt(m.videoViews || 0),
        cpv: parseFloat((m.averageCpv || 0) / 1e6).toFixed(4),
      };
    });

    res.json({ campaigns });
  } catch (e) {
    if (e.message === 'NOT_AUTHENTICATED') return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /gads/adgroups — ad group metrics ────────────────────
app.get('/gads/adgroups', async (req, res) => {
  const { uid = 'default', customer_id, since, until } = req.query;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  const dateRange = since && until
    ? `segments.date BETWEEN '${since}' AND '${until}'`
    : `segments.date DURING LAST_30_DAYS`;

  try {
    const token = await getValidToken(uid);
    const results = await gadsQuery(token, customer_id.replace(/-/g, ''), `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.campaign,
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_per_conversion
      FROM ad_group
      WHERE ${dateRange}
        AND ad_group.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 1000
    `);

    const adGroups = results.map(r => {
      const m = r.metrics || {};
      const spend = (m.costMicros || 0) / 1e6;
      const conv = parseFloat(m.conversions || 0);
      return {
        id: r.adGroup?.id,
        name: r.adGroup?.name || '—',
        status: r.adGroup?.status || '—',
        campaignId: r.adGroup?.campaign?.replace('customers/*/campaigns/', ''),
        campaignName: r.campaign?.name || '—',
        spend: spend.toFixed(2),
        impressions: parseInt(m.impressions || 0),
        clicks: parseInt(m.clicks || 0),
        ctr: parseFloat((m.ctr || 0) * 100).toFixed(2),
        cpc: parseFloat((m.averageCpc || 0) / 1e6).toFixed(2),
        conversions: conv.toFixed(0),
        cpa: conv > 0 ? (spend / conv).toFixed(2) : '0',
      };
    });

    res.json({ adGroups });
  } catch (e) {
    if (e.message === 'NOT_AUTHENTICATED') return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    res.status(500).json({ error: e.message });
  }
});

// ── GET /gads/summary — account-level totals ─────────────────
app.get('/gads/summary', async (req, res) => {
  const { uid = 'default', customer_id, since, until } = req.query;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  const dateRange = since && until
    ? `segments.date BETWEEN '${since}' AND '${until}'`
    : `segments.date DURING LAST_30_DAYS`;

  try {
    const token = await getValidToken(uid);
    const results = await gadsQuery(token, customer_id.replace(/-/g, ''), `
      SELECT
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM customer
      WHERE ${dateRange}
    `);

    const m = results[0]?.metrics || {};
    const spend = (m.costMicros || 0) / 1e6;
    const conv = parseFloat(m.conversions || 0);
    res.json({
      spend: spend.toFixed(2),
      impressions: parseInt(m.impressions || 0),
      clicks: parseInt(m.clicks || 0),
      ctr: parseFloat((m.ctr || 0) * 100).toFixed(2),
      cpc: parseFloat((m.averageCpc || 0) / 1e6).toFixed(2),
      conversions: conv.toFixed(0),
      convValue: parseFloat(m.conversionsValue || 0).toFixed(2),
      cpa: conv > 0 ? (spend / conv).toFixed(2) : '0',
    });
  } catch (e) {
    if (e.message === 'NOT_AUTHENTICATED') return res.status(401).json({ error: 'NOT_AUTHENTICATED' });
    res.status(500).json({ error: e.message });
  }
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`KAIO-API running on port ${PORT}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? '✓ set' : '✗ missing'}`);
  console.log(`Developer Token: ${process.env.GOOGLE_DEVELOPER_TOKEN ? '✓ set' : '✗ missing'}`);
});
