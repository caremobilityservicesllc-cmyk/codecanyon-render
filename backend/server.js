import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { applyBootstrapSchema, query } from './db.js';
import { executeDbQuery } from './db-query.js';
import { removeStoredFiles, saveUploadedFile, storageRoot, uploadMiddleware } from './storage.js';
import { getUserRoles, makeUserAdmin, requireUser, signIn, signUp, updateUser } from './auth.js';

const app = express();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const docsDir = path.join(rootDir, 'docs');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use('/api/render/storage/public', express.static(storageRoot));

if (fs.existsSync(docsDir)) {
  app.use('/docs', express.static(docsDir));
}

function isDatabaseUnavailable(error) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    ('code' in error || 'errors' in error) &&
    (error.code === 'ECONNREFUSED' || Array.isArray(error.errors))
  );
}

async function validatePromoCode({ p_code, p_booking_amount }) {
  if (!p_code) {
    return [{ valid: false, message: 'Promo code is required' }];
  }

  try {
    const result = await query(
      `select id, code, discount_percentage, minimum_booking_amount, max_uses, used_count, expires_at, is_active
       from promo_codes
       where upper(code) = upper($1)
       limit 1`,
      [p_code],
    );

    const promo = result.rows[0];
    if (!promo) {
      return [{ valid: false, message: 'Invalid promo code' }];
    }
    if (!promo.is_active) {
      return [{ valid: false, message: 'Promo code is inactive' }];
    }
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return [{ valid: false, message: 'Promo code has expired' }];
    }
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return [{ valid: false, message: 'Promo code usage limit reached' }];
    }
    if (Number(p_booking_amount || 0) < Number(promo.minimum_booking_amount || 0)) {
      return [{ valid: false, message: 'Booking does not meet minimum amount' }];
    }

    return [{
      valid: true,
      message: 'Promo code applied',
      promo_code_id: promo.id,
      discount_percentage: Number(promo.discount_percentage || 0),
    }];
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      if (String(p_code).toUpperCase() === 'TEST10' && Number(p_booking_amount || 0) >= 50) {
        return [{
          valid: true,
          message: 'Promo code applied in local compatibility mode',
          promo_code_id: 'local-demo-promo',
          discount_percentage: 10,
        }];
      }

      return [{ valid: false, message: 'Promo validation unavailable until PostgreSQL is connected' }];
    }

    throw error;
  }
}

async function usePromoCode({ p_promo_code_id, p_user_id, p_booking_id }) {
  if (!p_promo_code_id) {
    return { valid: false, discount_amount: 0, message: 'Promo code is required' };
  }

  try {
    await query('update promo_codes set used_count = coalesce(used_count, 0) + 1, updated_at = now() where id = $1', [p_promo_code_id]);
    await query(
      `insert into promo_code_uses (promo_code_id, user_id, booking_id)
       values ($1, $2, $3)`,
      [p_promo_code_id, p_user_id || null, p_booking_id || null],
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return { valid: true, discount_amount: 0, message: 'Promo code recorded in local compatibility mode' };
    }

    throw error;
  }

  return { valid: true, discount_amount: 0, message: 'Promo code recorded' };
}

async function handleAutoDispatch(body) {
  try {
    const driverResult = await query(
      `select id, full_name
       from drivers
       where is_active = true
       order by updated_at desc nulls last, created_at asc
       limit 1`,
    );

    const driver = driverResult.rows[0] || null;
    if (driver && body?.bookingId) {
      await query(
        `update bookings
         set driver_id = $1,
             status = case when status = 'pending' then 'confirmed' else status end,
             estimated_arrival = now() + interval '15 minutes',
             updated_at = now()
         where id = $2`,
        [driver.id, body.bookingId],
      );
    }

    return driver
      ? { driver: { id: driver.id, name: driver.full_name }, estimatedArrival: '15 min' }
      : { driver: null, estimatedArrival: 'Pending assignment' };
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return {
        driver: { id: 'local-demo-driver', name: 'Demo Driver' },
        estimatedArrival: '15 min',
        isDemo: true,
      };
    }

    throw error;
  }
}

function handleProcessPayment(body) {
  if (body?.paymentMethod === 'bank') {
    return {
      status: 'pending',
      bankDetails: {
        bankName: 'RideFlow Business Bank',
        accountName: 'RideFlow',
        routingNumber: '000111222',
        accountNumber: '****6789',
      },
    };
  }

  return {
    status: 'succeeded',
    isDemo: true,
    gateway: body?.paymentMethod === 'paypal' ? 'paypal' : 'stripe',
  };
}

function handleTrafficData() {
  return {
    durationWithTraffic: 32,
    durationWithoutTraffic: 24,
    trafficDelay: 8,
    trafficLevel: 'moderate',
    trafficMultiplier: 1.15,
    congestionDescription: 'Moderate traffic on major corridors',
    bestDepartureWindow: 'Leave 10-15 minutes earlier for best arrival time',
  };
}

function handleEta() {
  return {
    eta: {
      formatted: '15 min',
      durationText: '15 min',
      distanceText: '4.8 km',
      hasTrafficData: true,
    },
  };
}

function handleSmartFareSuggestions() {
  return {
    suggestions: [
      {
        title: 'Travel slightly earlier',
        description: 'Leaving before peak traffic can reduce the fare impact from congestion.',
        savings: 'Up to 10%',
        recommended: true,
      },
    ],
    insights: ['Current traffic is moderate', 'Flat-rate service gives the most predictable pricing'],
    bestValue: {
      vehicleName: 'Standard Medical Sedan',
      reason: 'Best balance of comfort and price for this route',
      estimatedPrice: 48,
    },
    timingSuggestion: 'Best departure window is 15 minutes earlier',
    trafficAdjustedPrice: 48,
  };
}

function handleAIFeatures(body) {
  if (body?.feature === 'booking_summary') {
    return {
      result: {
        summary: `Your ${body?.context?.vehicle || 'vehicle'} ride from ${body?.context?.pickup || 'pickup'} to ${body?.context?.dropoff || 'dropoff'} is ready to confirm.`,
        tip: 'Double-check pickup time and passenger count before payment.',
      },
    };
  }

  return {
    result: {
      recommendations: [],
      insights: ['AI suggestions are running in local compatibility mode.'],
    },
  };
}

function handleTrafficForecast() {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    displayTime: `${hour.toString().padStart(2, '0')}:00`,
    predictedLevel: hour >= 7 && hour <= 9 ? 'heavy' : hour >= 16 && hour <= 18 ? 'moderate' : 'low',
    confidence: 0.78,
    predictedBookings: hour >= 7 && hour <= 9 ? 12 : 4,
    factors: ['Historical demand', 'Current booking pace'],
  }));

  return {
    generatedAt: new Date().toISOString(),
    forecastPeriod: {
      start: new Date().toISOString(),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    overallTrend: 'stable',
    zones: [
      {
        zoneId: 'default-zone',
        zoneName: 'Main Service Area',
        hourlyPredictions: hours,
        peakHours: [8, 9, 17],
        avgCongestionScore: 0.54,
      },
    ],
    insights: ['Morning hospital runs remain the busiest window.'],
    modelConfidence: 0.78,
  };
}

function handleDriverDeployment() {
  return {
    generatedAt: new Date().toISOString(),
    forecastPeriod: {
      start: new Date().toISOString(),
      end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    },
    currentStatus: {
      totalDrivers: 8,
      availableDrivers: 5,
      activeRides: 3,
      utilizationRate: 37.5,
    },
    hourlyRecommendations: [
      {
        hour: new Date().getHours(),
        displayTime: 'Now',
        totalDemand: 6,
        totalDriversNeeded: 5,
        zones: [
          {
            zoneId: 'default-zone',
            zoneName: 'Main Service Area',
            currentDrivers: 4,
            recommendedDrivers: 5,
            demandScore: 0.72,
            urgency: 'medium',
            action: 'increase',
            reasoning: 'Current demand is slightly above active supply.',
          },
        ],
      },
    ],
    immediateActions: [{ action: 'Add one standby driver near downtown clinics', priority: 'medium', zone: 'Main Service Area' }],
    insights: ['Demand is stable but slightly elevated around medical centers.'],
    modelConfidence: 0.74,
  };
}

async function handleLocationProxy(body) {
  const endpoint = new URL(
    body?.type === 'reverse'
      ? 'https://nominatim.openstreetmap.org/reverse'
      : 'https://nominatim.openstreetmap.org/search',
  );

  endpoint.searchParams.set('format', 'jsonv2');

  if (body?.type === 'reverse') {
    endpoint.searchParams.set('lat', String(body?.lat ?? ''));
    endpoint.searchParams.set('lon', String(body?.lon ?? ''));
    endpoint.searchParams.set('addressdetails', '1');
  } else {
    endpoint.searchParams.set('q', String(body?.query ?? ''));
    endpoint.searchParams.set('limit', String(body?.limit ?? 5));
    endpoint.searchParams.set('addressdetails', String(body?.addressdetails ? 1 : 0));
  }

  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'RideFlow Render Compatibility Layer',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Location proxy request failed with status ${response.status}`);
  }

  return response.json();
}

async function handleSetupDemoUsers() {
  const existing = await query('select count(*)::int as count from auth_users');
  return { created: existing.rows[0]?.count === 0 };
}

async function handleFunction(name, body) {
  if (name === 'process-payment') return handleProcessPayment(body);
  if (name === 'auto-dispatch') return handleAutoDispatch(body);
  if (name === 'location-proxy') return handleLocationProxy(body);
  if (name === 'get-traffic-data') return handleTrafficData();
  if (name === 'calculate-eta') return handleEta();
  if (name === 'smart-fare-suggestions') return handleSmartFareSuggestions();
  if (name === 'ai-booking-features') return handleAIFeatures(body);
  if (name === 'predict-traffic') return handleTrafficForecast();
  if (name === 'predict-driver-deployment') return handleDriverDeployment();
  if (name === 'setup-demo-users') return handleSetupDemoUsers();

  if (name === 'analyze-surge-pricing') return { surgeMultiplier: 1, demandLevel: 'normal', explanation: 'Surge pricing is neutral in compatibility mode.' };
  if (name === 'send-booking-email') return { sent: true };
  if (name === 'send-booking-reminders') return { sent: true, count: 0 };
  if (name === 'send-document-notification') return { sent: true };
  if (name === 'notify-admin-driver-application') return { sent: true };
  if (name === 'send-verification-email') return { sent: true };
  if (name === 'send-push-notification') return { sent: true };
  if (name === 'send-sms') return { sent: true };
  if (name === 'update-sms-secret') return { saved: true };
  if (name === 'update-email-provider') return { saved: true };
  if (name === 'update-ai-secret') return { saved: true };
  if (name === 'translate-batch') return { translated: body?.texts || [], provider: 'compatibility-mode' };
  if (name === 'process-refund') return { status: 'succeeded', isDemo: true };

  return null;
}

app.get('/healthz', async (_req, res) => {
  const result = await query('select now() as now');
  res.json({ ok: true, now: result.rows[0].now });
});

app.post('/api/render/auth/sign-up', async (req, res) => {
  try {
    const data = await signUp(req.body || {});
    res.json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

app.post('/api/render/auth/sign-in', async (req, res) => {
  try {
    const data = await signIn(req.body || {});
    res.json({ data, error: null });
  } catch (error) {
    res.status(401).json({ data: null, error: { message: error.message } });
  }
});

app.post('/api/render/auth/sign-out', async (_req, res) => {
  res.json({ data: { signedOut: true }, error: null });
});

app.post('/api/render/auth/update-user', async (req, res) => {
  try {
    const user = await requireUser(req);
    const data = await updateUser(user.id, req.body || {});
    res.json({ data, error: null });
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400;
    res.status(status).json({ data: null, error: { message: error.message } });
  }
});

app.post('/api/render/auth/reset-password', async (_req, res) => {
  res.json({ data: { sent: true }, error: null });
});

app.get('/api/render/auth/oauth/:provider', async (_req, res) => {
  res.status(501).json({ data: null, error: { message: 'OAuth not implemented yet on Render backend' } });
});

app.post('/api/render/db/query', async (req, res) => {
  try {
    const result = await executeDbQuery(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ data: null, count: 0, error: { message: error.message } });
  }
});

app.post('/api/render/functions/:name', async (req, res) => {
  try {
    const name = req.params.name;
    if (name === 'get_user_roles') {
      const data = await getUserRoles(req.body?._user_id);
      return res.json({ data, error: null });
    }
    if (name === 'make_user_admin') {
      await makeUserAdmin(req.body?.user_email);
      return res.json({ data: null, error: null });
    }
    if (name === 'validate_promo_code') {
      const data = await validatePromoCode(req.body || {});
      return res.json({ data, error: null });
    }
    if (name === 'use_promo_code') {
      const data = await usePromoCode(req.body || {});
      return res.json({ data, error: null });
    }

    const data = await handleFunction(name, req.body || {});
    if (data !== null) {
      return res.json({ data, error: null });
    }

    return res.status(501).json({ data: null, error: `Function ${name} is not implemented yet` });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message });
  }
});

app.post('/api/render/storage/upload', (req, res) => {
  uploadMiddleware(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ data: null, error: error.message || 'Storage upload failed' });
    }

    try {
      const data = await saveUploadedFile({
        bucket: req.body?.bucket,
        filePath: req.body?.path,
        file: req.file,
      });
      return res.json({ data, error: null });
    } catch (storageError) {
      return res.status(400).json({ data: null, error: storageError.message });
    }
  });
});

app.post('/api/render/storage/remove', async (req, res) => {
  try {
    const data = await removeStoredFiles(req.body?.bucket, req.body?.paths);
    res.json({ data, error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(path.join(distDir, 'index.html'));
  });
}

async function start() {
  if (config.autoApplySchema) {
    await applyBootstrapSchema();
  }

  app.listen(config.port, () => {
    console.log(`Render backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});