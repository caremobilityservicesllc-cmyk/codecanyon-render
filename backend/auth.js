import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { query, withTransaction } from './db.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function isMissingRelation(error, relationName) {
  return error && error.code === '42P01' && (!relationName || String(error.message || '').includes(`\"${relationName}\"`));
}

function sanitizeLegacyDriver(row) {
  const data = row.data || {};
  const email = data.portalEmail || data.email || `${row.id}@caremobility.local`;
  return {
    id: data.authUserId || row.id,
    email,
    metadata: {
      legacy_driver_id: row.id,
      full_name: data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' '),
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      role: data.role || 'driver',
      source: 'legacy_driver',
      legacy_username: data.portalUsername || data.username || null,
    },
  };
}

async function getLegacyDriverById(userId) {
  try {
    const result = await query(
      `select id, data
       from admin_drivers
       where id = $1
          or data->>'authUserId' = $1
       limit 1`,
      [userId],
    );
    return result.rows[0] || null;
  } catch (error) {
    if (isMissingRelation(error, 'admin_drivers')) {
      return null;
    }
    throw error;
  }
}

async function getLegacyDriverByLogin(login) {
  try {
    const result = await query(
      `select id, data
       from admin_drivers
       where lower(coalesce(data->>'portalEmail', data->>'email', '')) = lower($1)
          or lower(coalesce(data->>'portalUsername', data->>'username', '')) = lower($1)
       limit 1`,
      [login],
    );
    return result.rows[0] || null;
  } catch (error) {
    if (isMissingRelation(error, 'admin_drivers')) {
      return null;
    }
    throw error;
  }
}

function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    user_metadata: row.metadata || {},
  };
}

function buildSession(row) {
  const payload = { sub: row.id, email: row.email };
  const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS * 2 });
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: sanitizeUser(row),
  };
}

export async function getUserById(userId) {
  try {
    const result = await query('select id, email, metadata from auth_users where id = $1 limit 1', [userId]);
    if (result.rows[0]) {
      return result.rows[0];
    }
  } catch (error) {
    if (!isMissingRelation(error, 'auth_users')) {
      throw error;
    }
  }

  const legacyDriver = await getLegacyDriverById(userId);
  return legacyDriver ? sanitizeLegacyDriver(legacyDriver) : null;
}

export async function signUp({ email, password, options }) {
  const existing = await query('select id from auth_users where lower(email) = lower($1) limit 1', [email]);
  if (existing.rowCount) {
    throw new Error('User already registered');
  }

  const fullName = options?.data?.full_name || '';
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();

  const user = await withTransaction(async (client) => {
    await client.query(
      `insert into auth_users (id, email, password_hash, metadata)
       values ($1, $2, $3, $4::jsonb)`,
      [userId, email, passwordHash, JSON.stringify({ full_name: fullName })],
    );
    await client.query(
      `insert into profiles (id, email, full_name)
       values ($1, $2, $3)
       on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now()`,
      [userId, email, fullName],
    );
    await client.query(
      `insert into user_roles (user_id, role)
       values ($1, 'user')
       on conflict (user_id, role) do nothing`,
      [userId],
    );

    const created = await client.query('select id, email, metadata from auth_users where id = $1 limit 1', [userId]);
    return created.rows[0];
  });

  return {
    user: sanitizeUser(user),
    session: buildSession(user),
  };
}

export async function signIn({ email, password }) {
  try {
    const result = await query('select id, email, password_hash, metadata from auth_users where lower(email) = lower($1) limit 1', [email]);
    const user = result.rows[0];
    if (user) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new Error('Invalid login credentials');
      }

      return {
        user: sanitizeUser(user),
        session: buildSession(user),
      };
    }
  } catch (error) {
    if (!isMissingRelation(error, 'auth_users') && error.message !== 'Invalid login credentials') {
      throw error;
    }
  }

  const legacyDriver = await getLegacyDriverByLogin(email);
  if (!legacyDriver) {
    throw new Error('Invalid login credentials');
  }

  if ((legacyDriver.data?.password || '') !== password) {
    throw new Error('Invalid login credentials');
  }

  const user = sanitizeLegacyDriver(legacyDriver);
  return {
    user: sanitizeUser(user),
    session: buildSession(user),
  };
}

export async function updateUser(userId, payload) {
  const fields = [];
  const values = [];
  let param = 1;

  if (typeof payload.password === 'string' && payload.password.length > 0) {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    fields.push(`password_hash = $${param++}`);
    values.push(passwordHash);
  }

  if (payload.data && typeof payload.data === 'object') {
    fields.push(`metadata = coalesce(metadata, '{}'::jsonb) || $${param++}::jsonb`);
    values.push(JSON.stringify(payload.data));

    if (typeof payload.data.full_name === 'string') {
      await query('update profiles set full_name = $1, updated_at = now() where id = $2', [payload.data.full_name, userId]);
    }
  }

  if (fields.length) {
    values.push(userId);
    await query(`update auth_users set ${fields.join(', ')}, updated_at = now() where id = $${param}`, values);
  }

  const updated = await getUserById(userId);
  return {
    user: sanitizeUser(updated),
    session: buildSession(updated),
  };
}

export async function getUserRoles(userId) {
  try {
    const result = await query('select role from user_roles where user_id = $1 order by role asc', [userId]);
    if (result.rowCount) {
      return result.rows.map((row) => row.role);
    }
  } catch (error) {
    if (!isMissingRelation(error, 'user_roles')) {
      throw error;
    }
  }

  const legacyDriver = await getLegacyDriverById(userId);
  if (!legacyDriver) {
    return [];
  }

  const role = String(legacyDriver.data?.role || '').toLowerCase();
  if (role === 'admin' || role === 'moderator' || role === 'user') {
    return [role];
  }

  return ['user'];
}

export async function makeUserAdmin(userEmail) {
  const result = await query('select id from auth_users where lower(email) = lower($1) limit 1', [userEmail]);
  const user = result.rows[0];
  if (!user) {
    throw new Error('User not found');
  }

  await query(
    `insert into user_roles (user_id, role)
     values ($1, 'admin')
     on conflict (user_id, role) do nothing`,
    [user.id],
  );

  return null;
}

export function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

export async function requireUser(req) {
  const token = readBearerToken(req);
  if (!token) {
    throw new Error('Unauthorized');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new Error('Unauthorized');
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}