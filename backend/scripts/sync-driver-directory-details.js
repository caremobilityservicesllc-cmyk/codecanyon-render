import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';
import { findDriverDirectoryOverride } from './driver-directory-overrides.js';

const REMOTE_BASE_URL = 'https://codecanyon-render.onrender.com/api/render';
const CONTACT_SYNC_NOTE = 'Driver phone/username synced from provided user directory screenshots on 2026-04-24.';
const IMPORT_MARKER = 'Imported from LICENCE folder on 2026-04-24';

function lastTwoDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 2 ? digits.slice(-2) : '00';
}

function buildPassword(username, phone) {
  return `${username}@${lastTwoDigits(phone)}`;
}

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing}\n${note}`;
}

async function remotePost(path, body, accessToken) {
  const headers = { 'content-type': 'application/json' };
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${REMOTE_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.error || `Remote request failed: ${response.status}`);
  }

  return payload;
}

async function loadLocalDrivers() {
  const result = await query(
    `select id, user_id, full_name, first_name, last_name, phone, email, verification_notes
     from drivers
     where verification_notes ilike $1
     order by last_name asc, first_name asc`,
    [`%${IMPORT_MARKER}%`],
  );
  return result.rows;
}

async function loadRemoteDrivers() {
  const payload = await remotePost('/db/query', {
    table: 'drivers',
    operation: 'select',
    select: 'id,user_id,full_name,first_name,last_name,phone,email,verification_notes',
    filters: [{ column: 'verification_notes', operator: 'ilike', value: `%${IMPORT_MARKER}%` }],
    orderBy: [
      { column: 'last_name', ascending: true },
      { column: 'first_name', ascending: true },
    ],
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function syncLocalDriver(driver, override) {
  const username = override.username;
  const phone = override.phone || driver.phone;
  const password = buildPassword(username, phone);
  const notes = appendNote(driver.verification_notes, CONTACT_SYNC_NOTE);

  await query(
    `update drivers
     set phone = $1,
         email = $2,
         verification_notes = $3,
         updated_at = now()
     where id = $4`,
    [phone, username, notes, driver.id],
  );

  if (driver.user_id) {
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `update auth_users
       set email = $1,
           password_hash = $2,
           metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       where id = $4`,
      [username, passwordHash, JSON.stringify({ username }), driver.user_id],
    );

    await query(
      `update profiles
       set email = $1,
           updated_at = now()
       where id = $2`,
      [username, driver.user_id],
    );
  }

  return { username, password, phone };
}

async function syncRemoteDriver(driver, override) {
  const currentLogin = driver.email;
  const previousLogin = override.previousLogin || currentLogin;
  const username = override.username;
  const phone = override.phone || driver.phone;
  const password = buildPassword(username, phone);
  let accessToken = null;
  let userId = driver.user_id || null;
  const loginChanged = String(previousLogin || '').toLowerCase() !== String(username).toLowerCase();

  if (!loginChanged) {
    const currentPassword = buildPassword(previousLogin, driver.phone);
    const signInPayload = await remotePost('/auth/sign-in', { email: previousLogin, password: currentPassword });
    accessToken = signInPayload.data?.session?.access_token;
    userId = signInPayload.data?.user?.id || userId;

    if (!accessToken || !userId) {
      throw new Error(`Could not authenticate remote driver ${driver.full_name}`);
    }

    await remotePost(
      '/auth/update-user',
      {
        password,
        data: {
          username,
        },
      },
      accessToken,
    );
  } else {
    try {
      const signUpPayload = await remotePost('/auth/sign-up', {
        email: username,
        password,
        options: {
          data: {
            full_name: driver.full_name,
          },
        },
      });
      accessToken = signUpPayload.data?.session?.access_token || null;
      userId = signUpPayload.data?.user?.id || signUpPayload.data?.session?.user?.id || userId;
    } catch (error) {
      if (!String(error.message || '').includes('User already registered')) {
        throw error;
      }

      const signInPayload = await remotePost('/auth/sign-in', { email: username, password });
      accessToken = signInPayload.data?.session?.access_token || null;
      userId = signInPayload.data?.user?.id || userId;
    }

    if (!accessToken || !userId) {
      throw new Error(`Could not provision remote login ${username} for ${driver.full_name}`);
    }

    await remotePost(
      '/auth/update-user',
      {
        data: {
          username,
        },
      },
      accessToken,
    );
  }

  await remotePost('/db/query', {
    table: 'drivers',
    operation: 'update',
    filters: [{ column: 'id', operator: 'eq', value: driver.id }],
    values: {
      phone,
      email: username,
      verification_notes: appendNote(driver.verification_notes, CONTACT_SYNC_NOTE),
      updated_at: new Date().toISOString(),
    },
  });

  await remotePost('/db/query', {
    table: 'profiles',
    operation: 'update',
    filters: [{ column: 'id', operator: 'eq', value: userId }],
    values: {
      email: username,
      updated_at: new Date().toISOString(),
    },
  });

  return { username, password, phone };
}

async function runLocalSync() {
  const drivers = await loadLocalDrivers();
  const results = [];

  for (const driver of drivers) {
    const override = findDriverDirectoryOverride(driver);
    if (!override) continue;
    results.push({ full_name: driver.full_name, ...(await syncLocalDriver(driver, override)) });
  }

  return results;
}

async function runRemoteSync() {
  const drivers = await loadRemoteDrivers();
  const results = [];

  for (const driver of drivers) {
    const override = findDriverDirectoryOverride(driver);
    if (!override) continue;
    results.push({ full_name: driver.full_name, ...(await syncRemoteDriver(driver, override)) });
  }

  return results;
}

async function main() {
  const target = process.argv[2] || 'both';
  const summary = {};

  if (target === 'local' || target === 'both') {
    const local = await runLocalSync();
    summary.local = {
      updated: local.length,
      sample: local.slice(0, 6),
    };
  }

  if (target === 'remote' || target === 'both') {
    const remote = await runRemoteSync();
    summary.remote = {
      updated: remote.length,
      sample: remote.slice(0, 6),
    };
  }

  console.log(JSON.stringify({ target, summary }, null, 2));
}

try {
  await main();
  await pool.end();
} catch (error) {
  console.error(error);
  await pool.end();
  process.exit(1);
}