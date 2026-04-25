import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { query, withTransaction } from './db.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function firstNameFromFullName(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean)[0] || '';
}

function getUserMetadata(user) {
  return user?.metadata && typeof user.metadata === 'object' ? user.metadata : {};
}

function getUserIdentifiers(user) {
  const metadata = getUserMetadata(user);
  const identifiers = new Set();
  const email = normalizeIdentifier(user?.email);
  const username = normalizeIdentifier(metadata.username);
  const fullName = normalizeIdentifier(metadata.full_name);
  const firstName = normalizeIdentifier(firstNameFromFullName(metadata.full_name));

  if (email) {
    identifiers.add(email);
    const localPart = email.split('@')[0];
    if (localPart) identifiers.add(localPart);
  }
  if (username) identifiers.add(username);
  if (fullName) identifiers.add(fullName);
  if (firstName) identifiers.add(firstName);

  return identifiers;
}

function getDesiredRoles(user) {
  const metadata = getUserMetadata(user);
  const roles = new Set(['user']);
  const declaredRole = normalizeIdentifier(metadata.role);
  const isAdmin = metadata.is_admin === true;
  const isBootstrapAdmin = Array.from(getUserIdentifiers(user)).some((identifier) => config.adminIdentifiers.includes(identifier));

  if (declaredRole === 'admin' || isAdmin || isBootstrapAdmin) {
    roles.add('admin');
  }

  if (declaredRole === 'moderator') {
    roles.add('moderator');
  }

  return Array.from(roles).sort();
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    return null;
  }

  const result = await query(
    `select au.id, au.email, au.metadata
     from auth_users au
     left join profiles p on p.id = au.id
     where lower(au.email) = lower($1)
        or lower(coalesce(au.metadata->>'username', '')) = lower($1)
        or lower(coalesce(au.metadata->>'full_name', '')) = lower($1)
        or split_part(lower(coalesce(au.metadata->>'full_name', '')), ' ', 1) = lower($1)
        or lower(coalesce(p.email, '')) = lower($1)
        or lower(coalesce(p.full_name, '')) = lower($1)
        or split_part(lower(coalesce(p.full_name, '')), ' ', 1) = lower($1)
     limit 1`,
    [normalizedIdentifier],
  );

  return result.rows[0] || null;
}

async function syncUserRoles(userOrId, existingRoles = null) {
  const user = typeof userOrId === 'string' ? await getUserById(userOrId) : userOrId;
  if (!user) {
    return existingRoles || [];
  }

  const desiredRoles = getDesiredRoles(user);
  const currentRoles = new Set(existingRoles || []);
  const missingRoles = desiredRoles.filter((role) => !currentRoles.has(role));

  if (missingRoles.length) {
    await withTransaction(async (client) => {
      for (const role of missingRoles) {
        await client.query(
          `insert into user_roles (user_id, role)
           values ($1, $2)
           on conflict (user_id, role) do nothing`,
          [user.id, role],
        );
      }

      if (missingRoles.includes('admin')) {
        await client.query(
          `update auth_users
           set metadata = coalesce(metadata, '{}'::jsonb) || '{"role":"admin","is_admin":true}'::jsonb,
               updated_at = now()
           where id = $1`,
          [user.id],
        );
      }
    });
  }

  return desiredRoles;
}

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

  const metadata = options?.data && typeof options.data === 'object' ? { ...options.data } : {};
  const fullName = metadata.full_name || '';
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const desiredRoles = getDesiredRoles({ id: userId, email, metadata });

  const user = await withTransaction(async (client) => {
    await client.query(
      `insert into auth_users (id, email, password_hash, metadata)
       values ($1, $2, $3, $4::jsonb)`,
      [userId, email, passwordHash, JSON.stringify(metadata)],
    );
    await client.query(
      `insert into profiles (id, email, full_name)
       values ($1, $2, $3)
       on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now()`,
      [userId, email, fullName],
    );
    for (const role of desiredRoles) {
      await client.query(
        `insert into user_roles (user_id, role)
         values ($1, $2)
         on conflict (user_id, role) do nothing`,
        [userId, role],
      );
    }

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
    const result = await query(
      `select id, email, password_hash, metadata
       from auth_users
       where lower(email) = lower($1)
          or lower(coalesce(metadata->>'username', '')) = lower($1)
       limit 1`,
      [email],
    );
    const user = result.rows[0];
    if (user) {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new Error('Invalid login credentials');
      }

      await syncUserRoles(user);

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
    const roles = result.rows.map((row) => row.role);
    const syncedRoles = await syncUserRoles(userId, roles);
    if (syncedRoles.length) {
      return syncedRoles;
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
  const user = await findUserByIdentifier(userEmail);
  if (!user) {
    throw new Error('User not found');
  }

  await withTransaction(async (client) => {
    await client.query(
      `insert into user_roles (user_id, role)
       values ($1, 'admin')
       on conflict (user_id, role) do nothing`,
      [user.id],
    );

    await client.query(
      `insert into user_roles (user_id, role)
       values ($1, 'user')
       on conflict (user_id, role) do nothing`,
      [user.id],
    );

    await client.query(
      `update auth_users
       set metadata = coalesce(metadata, '{}'::jsonb) || '{"role":"admin","is_admin":true}'::jsonb,
           updated_at = now()
       where id = $1`,
      [user.id],
    );
  });

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