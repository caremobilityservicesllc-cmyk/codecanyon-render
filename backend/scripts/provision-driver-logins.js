import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';
import { findDriverDirectoryOverride } from './driver-directory-overrides.js';

const REMOTE_BASE_URL = 'https://codecanyon-render.onrender.com/api/render';
const IMPORT_MARKER = 'Imported from LICENCE folder on 2026-04-24';
const PROVISION_NOTE = 'Driver login provisioned on 2026-04-24';

function stripAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toUsername(firstName, usedNames) {
  const base = stripAccents(String(firstName || '').trim().split(/\s+/)[0] || 'Driver')
    .replace(/[^A-Za-z0-9]/g, '');
  const normalizedBase = base ? `${base.charAt(0).toUpperCase()}${base.slice(1).toLowerCase()}` : 'Driver';

  let candidate = normalizedBase;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${normalizedBase}${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function resolvePreferredUsername(driver, usedNames) {
  const override = findDriverDirectoryOverride(driver);
  if (override?.username) {
    usedNames.add(String(override.username).toLowerCase());
    return override.username;
  }
  return toUsername(driver.first_name, usedNames);
}

function lastTwoDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 2 ? digits.slice(-2) : '00';
}

function buildPassword(username, phone) {
  return `${username}@${lastTwoDigits(phone)}`;
}

function reserveLoginIdentifier(username, usedLogins) {
  let candidate = username;
  let suffix = 2;
  while (usedLogins.has(candidate.toLowerCase())) {
    candidate = `${username}${suffix}`;
    suffix += 1;
  }
  usedLogins.add(candidate.toLowerCase());
  return candidate;
}

function appendNote(existing, note) {
  if (!existing) return note;
  if (existing.includes(note)) return existing;
  return `${existing}\n${note}`;
}

async function loadDriversLocal() {
  const result = await query(
    `select id, user_id, full_name, first_name, last_name, phone, email, verification_notes
     from drivers
     where verification_notes ilike $1
     order by last_name asc, first_name asc`,
    [`%${IMPORT_MARKER}%`],
  );
  return result.rows;
}

async function loadExistingAuthUsersLocal() {
  const result = await query(`select id, email, metadata from auth_users`);
  return result.rows;
}

async function upsertLocalDriverLogin(driver, username, loginIdentifier, password) {
  const existingUserByDriver = driver.user_id
    ? await query('select id, email, metadata from auth_users where id = $1 limit 1', [driver.user_id])
    : { rows: [] };

  const existingUserByIdentity = await query(
    `select id, email, metadata
     from auth_users
      where lower(email) = lower($1)
        or lower(coalesce(metadata->>'username', '')) = lower($2)
     limit 1`,
     [loginIdentifier, username],
  );

  const existingUser = existingUserByDriver.rows[0] || existingUserByIdentity.rows[0] || null;
  const passwordHash = await bcrypt.hash(password, 10);
  const metadata = {
    full_name: driver.full_name,
    first_name: driver.first_name,
    last_name: driver.last_name,
    role: 'driver',
    username,
    driver_id: driver.id,
  };

  let userId = existingUser?.id || null;

  if (existingUser) {
    await query(
      `update auth_users
       set email = $1,
           password_hash = $2,
           metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       where id = $4`,
      [loginIdentifier, passwordHash, JSON.stringify(metadata), existingUser.id],
    );

    await query(
      `insert into profiles (id, email, full_name)
       values ($1, $2, $3)
       on conflict (id) do update
       set email = excluded.email,
           full_name = excluded.full_name,
           updated_at = now()`,
      [existingUser.id, loginIdentifier, driver.full_name],
    );
    userId = existingUser.id;
  } else {
    const insertUser = await query(
      `insert into auth_users (email, password_hash, metadata)
       values ($1, $2, $3::jsonb)
       returning id`,
      [loginIdentifier, passwordHash, JSON.stringify(metadata)],
    );
    userId = insertUser.rows[0].id;

    await query(
      `insert into profiles (id, email, full_name)
       values ($1, $2, $3)
       on conflict (id) do update
       set email = excluded.email,
           full_name = excluded.full_name,
           updated_at = now()`,
      [userId, loginIdentifier, driver.full_name],
    );
  }

  await query(
    `insert into user_roles (user_id, role)
     values ($1, 'user')
     on conflict (user_id, role) do nothing`,
    [userId],
  );

  await query(
    `update drivers
     set user_id = $1,
         email = $2,
         verification_notes = $3,
         updated_at = now()
     where id = $4`,
    [userId, loginIdentifier, appendNote(driver.verification_notes, PROVISION_NOTE), driver.id],
  );

  return { userId, username, email: loginIdentifier, password };
}

async function remotePost(path, body) {
  const response = await fetch(`${REMOTE_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.error || `Remote request failed: ${response.status}`);
  }
  return payload;
}

async function loadDriversRemote() {
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

async function loadExistingAuthUsersRemote() {
  const payload = await remotePost('/db/query', {
    table: 'profiles',
    operation: 'select',
    select: 'id,email,full_name',
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function upsertRemoteDriverLogin(driver, username, loginIdentifier, password) {
  let userId = driver.user_id || null;

  if (!userId) {
    try {
      const signUpResponse = await remotePost('/auth/sign-up', {
        email: loginIdentifier,
        password,
        options: {
          data: {
            full_name: driver.full_name,
          },
        },
      });
      userId = signUpResponse.data?.user?.id || signUpResponse.data?.session?.user?.id || null;
    } catch (error) {
      if (!String(error.message || '').includes('User already registered')) {
        throw error;
      }
    }
  }

  if (!userId) {
    const profileLookup = await remotePost('/db/query', {
      table: 'profiles',
      operation: 'select',
      select: 'id,email,full_name',
      filters: [{ column: 'email', operator: 'eq', value: loginIdentifier }],
      limit: 1,
    });
    const profile = Array.isArray(profileLookup.data) ? profileLookup.data[0] : profileLookup.data;
    userId = profile?.id || null;
  }

  if (!userId) {
    throw new Error(`Could not resolve remote auth user for ${loginIdentifier}`);
  }

  await remotePost('/db/query', {
    table: 'profiles',
    operation: 'update',
    filters: [{ column: 'id', operator: 'eq', value: userId }],
    values: {
      email: loginIdentifier,
      full_name: driver.full_name,
      updated_at: new Date().toISOString(),
    },
  });

  await remotePost('/db/query', {
    table: 'drivers',
    operation: 'update',
    filters: [{ column: 'id', operator: 'eq', value: driver.id }],
    values: {
      user_id: userId,
      email: loginIdentifier,
      verification_notes: appendNote(driver.verification_notes, PROVISION_NOTE),
      updated_at: new Date().toISOString(),
    },
  });
  return { userId, username, email: loginIdentifier, password };
}

async function provisionLocal() {
  const drivers = await loadDriversLocal();
  const existingUsers = await loadExistingAuthUsersLocal();
  const usedNames = new Set(existingUsers.map((row) => String(row.metadata?.username || '').toLowerCase()).filter(Boolean));
  const usedLogins = new Set(existingUsers.map((row) => String(row.email || '').toLowerCase()).filter(Boolean));
  const results = [];

  for (const driver of drivers) {
    const username = resolvePreferredUsername(driver, usedNames);
    const loginIdentifier = reserveLoginIdentifier(username, usedLogins);
    const password = buildPassword(username, driver.phone);
    results.push(await upsertLocalDriverLogin(driver, username, loginIdentifier, password));
  }

  return results;
}

async function provisionRemote() {
  const drivers = await loadDriversRemote();
  const existingProfiles = await loadExistingAuthUsersRemote();
  const usedNames = new Set();
  const usedLogins = new Set(existingProfiles.map((row) => String(row.email || '').toLowerCase()).filter(Boolean));
  const results = [];

  for (const driver of drivers) {
    const username = resolvePreferredUsername(driver, usedNames);
    const loginIdentifier = reserveLoginIdentifier(username, usedLogins);
    const password = buildPassword(username, driver.phone);
    results.push(await upsertRemoteDriverLogin(driver, username, loginIdentifier, password));
  }
  return results;
}

async function main() {
  const target = process.argv[2] || 'both';
  const summary = {};

  if (target === 'local' || target === 'both') {
    const local = await provisionLocal();
    summary.local = {
      provisioned: local.length,
      sample: local.slice(0, 5).map(({ username, email, password }) => ({ username, email, password })),
    };
  }

  if (target === 'remote' || target === 'both') {
    const remote = await provisionRemote();
    summary.remote = {
      provisioned: remote.length,
      sample: remote.slice(0, 5).map(({ username, email, password }) => ({ username, email, password })),
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