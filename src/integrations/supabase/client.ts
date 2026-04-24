import type { Database } from './types';

const RENDER_API_URL = String(import.meta.env.VITE_RENDER_API_URL || '/api/render').replace(/\/$/, '');
const RENDER_STORAGE_URL = String(import.meta.env.VITE_RENDER_STORAGE_URL || `${RENDER_API_URL}/storage`).replace(/\/$/, '');
const AUTH_STORAGE_KEY = String(import.meta.env.VITE_RENDER_AUTH_STORAGE_KEY || 'rideflow-render-session');
const LOCAL_AUTH_USERS_KEY = 'rideflow-render-local-users';
const LOCAL_DB_KEY = 'rideflow-render-local-db';

type RenderSession = {
  access_token?: string;
  refresh_token?: string;
  user?: any;
};

type AuthChangeCallback = (event: string, session: RenderSession | null) => void;

type ChannelPayload = {
  eventType: string;
  new: Record<string, any> | null;
  old: Record<string, any> | null;
};

type LocalAuthUser = {
  id: string;
  email: string;
  password: string;
  full_name?: string;
  roles: string[];
  created_at: string;
  updated_at: string;
};

type LocalDatabaseState = {
  system_settings: Array<Record<string, any>>;
  profiles: Array<Record<string, any>>;
  user_roles: Array<Record<string, any>>;
};

type QueryState = {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  values?: unknown;
  filters: Array<{ column: string; operator: string; value: unknown }>;
  orderBy: Array<{ column: string; ascending: boolean }>;
  limit?: number;
  range?: { from: number; to: number };
  single?: boolean;
  maybeSingle?: boolean;
  options?: Record<string, unknown>;
};

function parseOrFilterExpression(expression: string): QueryState['filters'] {
  return String(expression || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([^=]+)=([a-z]+)\.(.+)$/i);
      if (!match) return null;

      const [, column, operator, value] = match;
      if (!['eq', 'neq', 'ilike'].includes(operator)) return null;
      return { column, operator, value };
    })
    .filter(Boolean) as QueryState['filters'];
}

const authListeners = new Set<AuthChangeCallback>();

function notifyAuthListeners(event: string, session: RenderSession | null) {
  authListeners.forEach((listener) => listener(event, session));
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function createToken() {
  return `token-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in compatibility mode.
  }
}

function readStoredSession(): RenderSession | null {
  return readJsonStorage<RenderSession | null>(AUTH_STORAGE_KEY, null);
}

function writeStoredSession(session: RenderSession | null, event: string) {
  try {
    if (session) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in compatibility mode.
  }

  notifyAuthListeners(event, session);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_STORAGE_KEY) {
      return;
    }

    if (!event.newValue) {
      notifyAuthListeners('SIGNED_OUT', null);
      return;
    }

    try {
      notifyAuthListeners('STORAGE_SYNC', JSON.parse(event.newValue) as RenderSession);
    } catch {
      notifyAuthListeners('STORAGE_SYNC', null);
    }
  });
}

function ensureLocalDatabase(): LocalDatabaseState {
  const database = readJsonStorage<LocalDatabaseState>(LOCAL_DB_KEY, {
    system_settings: [],
    profiles: [],
    user_roles: [],
  });

  if (!database.system_settings.some((entry) => entry.key === 'setup_completed')) {
    database.system_settings.push({
      id: createId('setting'),
      key: 'setup_completed',
      value: false,
      category: 'system',
      description: 'Whether the initial setup wizard has been completed',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  writeJsonStorage(LOCAL_DB_KEY, database);
  return database;
}

function readLocalUsers() {
  return readJsonStorage<LocalAuthUser[]>(LOCAL_AUTH_USERS_KEY, []);
}

function writeLocalUsers(users: LocalAuthUser[]) {
  writeJsonStorage(LOCAL_AUTH_USERS_KEY, users);
}

function shouldUseLocalFallback(error: Error | null) {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return message.includes('econnrefused')
    || message.includes('connect')
    || message.includes('database')
    || message.includes('pg-pool');
}

function buildSessionFromUser(user: LocalAuthUser): RenderSession {
  return {
    access_token: createToken(),
    refresh_token: createToken(),
    user: {
      id: user.id,
      email: user.email,
      user_metadata: {
        full_name: user.full_name,
      },
    },
  };
}

function syncProfileForUser(user: LocalAuthUser) {
  const database = ensureLocalDatabase();
  const profileIndex = database.profiles.findIndex((profile) => profile.id === user.id);
  const profile = {
    id: user.id,
    email: user.email,
    full_name: user.full_name || '',
    role: user.roles[0] || 'user',
    updated_at: nowIso(),
  };

  if (profileIndex >= 0) {
    database.profiles[profileIndex] = {
      ...database.profiles[profileIndex],
      ...profile,
    };
  } else {
    database.profiles.push({
      ...profile,
      created_at: nowIso(),
    });
  }

  database.user_roles = database.user_roles.filter((entry) => entry.user_id !== user.id);
  user.roles.forEach((role) => {
    database.user_roles.push({
      id: createId('role'),
      user_id: user.id,
      role,
      created_at: nowIso(),
    });
  });

  writeJsonStorage(LOCAL_DB_KEY, database);
}

function normalizeFullName(options?: Record<string, unknown>) {
  if (!options || typeof options.data !== 'object' || options.data === null) {
    return '';
  }

  return String((options.data as Record<string, unknown>).full_name || '');
}

function localSignUp(payload: { email: string; password: string; options?: Record<string, unknown> }) {
  const users = readLocalUsers();
  const existingUser = users.find((user) => user.email.toLowerCase() === payload.email.toLowerCase());
  if (existingUser) {
    return {
      data: null,
      error: new Error('User already registered'),
    };
  }

  const newUser: LocalAuthUser = {
    id: createId('user'),
    email: payload.email,
    password: payload.password,
    full_name: normalizeFullName(payload.options),
    roles: ['user'],
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  users.push(newUser);
  writeLocalUsers(users);
  syncProfileForUser(newUser);

  const session = buildSessionFromUser(newUser);
  writeStoredSession(session, 'SIGNED_UP');

  return {
    data: {
      user: session.user,
      session,
    },
    error: null,
  };
}

function localSignIn(credentials: { email: string; password: string }) {
  const users = readLocalUsers();
  const user = users.find((entry) => entry.email.toLowerCase() === credentials.email.toLowerCase());
  if (!user || user.password !== credentials.password) {
    return {
      data: null,
      error: new Error('Invalid login credentials'),
    };
  }

  syncProfileForUser(user);
  const session = buildSessionFromUser(user);
  writeStoredSession(session, 'SIGNED_IN');

  return {
    data: {
      user: session.user,
      session,
    },
    error: null,
  };
}

function localUpdateUser(payload: Record<string, unknown>) {
  const session = readStoredSession();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      data: null,
      error: new Error('No active session'),
    };
  }

  const users = readLocalUsers();
  const userIndex = users.findIndex((user) => user.id === userId);
  if (userIndex < 0) {
    return {
      data: null,
      error: new Error('User not found'),
    };
  }

  const currentUser = users[userIndex];
  const nextName = typeof payload.data === 'object' && payload.data !== null && 'full_name' in payload.data
    ? String((payload.data as Record<string, unknown>).full_name || currentUser.full_name || '')
    : currentUser.full_name;

  const updatedUser: LocalAuthUser = {
    ...currentUser,
    password: typeof payload.password === 'string' ? payload.password : currentUser.password,
    full_name: nextName,
    updated_at: nowIso(),
  };

  users[userIndex] = updatedUser;
  writeLocalUsers(users);
  syncProfileForUser(updatedUser);

  const nextSession = buildSessionFromUser(updatedUser);
  writeStoredSession(nextSession, 'USER_UPDATED');

  return {
    data: {
      user: nextSession.user,
      session: nextSession,
    },
    error: null,
  };
}

function getLocalRoles(userId?: string) {
  if (!userId) return [];
  const users = readLocalUsers();
  return users.find((user) => user.id === userId)?.roles || [];
}

function localRpc(name: string, args?: Record<string, unknown>) {
  if (name === 'get_user_roles') {
    return { data: getLocalRoles(typeof args?._user_id === 'string' ? args._user_id : undefined), error: null };
  }

  if (name === 'make_user_admin') {
    const email = typeof args?.user_email === 'string' ? args.user_email : '';
    const users = readLocalUsers();
    const userIndex = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());
    if (userIndex < 0) {
      return { data: null, error: new Error('User not found') };
    }

    const roles = new Set(users[userIndex].roles);
    roles.add('admin');
    users[userIndex] = {
      ...users[userIndex],
      roles: Array.from(roles),
      updated_at: nowIso(),
    };
    writeLocalUsers(users);
    syncProfileForUser(users[userIndex]);

    const currentSession = readStoredSession();
    if (currentSession?.user?.id === users[userIndex].id) {
      writeStoredSession(buildSessionFromUser(users[userIndex]), 'USER_UPDATED');
    }

    return { data: null, error: null };
  }

  if (name === 'use_promo_code') {
    return { data: { valid: false, discount_amount: 0 }, error: null };
  }

  return { data: null, error: new Error(`Local RPC ${name} is not implemented`) };
}

async function remoteRpc(name: string, args?: Record<string, unknown>) {
  const response = await fetch(`${RENDER_API_URL}/functions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: readStoredSession()?.access_token ? `Bearer ${readStoredSession()?.access_token}` : '',
    },
    body: JSON.stringify(args || {}),
  });

  const payload = await response.json();
  const error = response.ok ? null : new Error(payload.error?.message || payload.error || `Render RPC ${name} failed`);
  return {
    data: payload.data ?? null,
    error,
  };
}

function normalizeValues(values: unknown) {
  if (Array.isArray(values)) return values;
  if (values == null) return [];
  return [values];
}

function applyFilters(rows: Array<Record<string, any>>, filters: QueryState['filters']) {
  return rows.filter((row) => filters.every((filter) => {
    if (filter.operator === 'or' && Array.isArray(filter.value)) {
      return filter.value.some((entry) => applyFilters([row], [entry as QueryState['filters'][number]]).length > 0);
    }

    const cell = row[filter.column];
    if (filter.operator === 'eq') return cell === filter.value;
    if (filter.operator === 'neq') return cell !== filter.value;
    if (filter.operator === 'in') return Array.isArray(filter.value) && filter.value.includes(cell);
    if (filter.operator === 'ilike') {
      const haystack = String(cell ?? '').toLowerCase();
      const needle = String(filter.value ?? '').toLowerCase().replace(/%/g, '');
      return haystack.includes(needle);
    }
    return true;
  }));
}

function applyOrdering(rows: Array<Record<string, any>>, orderBy: QueryState['orderBy']) {
  if (!orderBy.length) return rows;
  return [...rows].sort((left, right) => {
    for (const order of orderBy) {
      const a = left[order.column];
      const b = right[order.column];
      if (a === b) continue;
      const result = a > b ? 1 : -1;
      return order.ascending ? result : -result;
    }
    return 0;
  });
}

function runLocalQuery(state: QueryState) {
  const database = ensureLocalDatabase();
  const tableName = state.table as keyof LocalDatabaseState;
  const table = Array.isArray(database[tableName]) ? [...database[tableName]] : [];

  if (state.operation === 'select') {
    let rows = applyFilters(table, state.filters);
    rows = applyOrdering(rows, state.orderBy);
    if (typeof state.limit === 'number') {
      rows = rows.slice(0, state.limit);
    }
    if (state.range) {
      rows = rows.slice(state.range.from, state.range.to + 1);
    }

    if (state.single || state.maybeSingle) {
      return { data: rows[0] ?? null, error: null, count: rows.length };
    }

    return { data: rows, error: null, count: rows.length };
  }

  const mutableDatabase = database as Record<string, any[]>;
  if (!Array.isArray(mutableDatabase[state.table])) {
    mutableDatabase[state.table] = [];
  }
  const mutableTable = mutableDatabase[state.table];

  if (state.operation === 'insert') {
    const inserted = normalizeValues(state.values).map((value) => ({
      id: value && typeof value === 'object' && 'id' in (value as Record<string, unknown>) ? (value as Record<string, unknown>).id : createId(state.table),
      created_at: nowIso(),
      updated_at: nowIso(),
      ...(value as Record<string, unknown>),
    }));
    mutableTable.push(...inserted);
    writeJsonStorage(LOCAL_DB_KEY, database);
    return { data: inserted, error: null, count: inserted.length };
  }

  if (state.operation === 'upsert') {
    const entries = normalizeValues(state.values);
    const onConflict = typeof state.options?.onConflict === 'string' ? state.options.onConflict : 'id';
    const upserted = entries.map((value) => {
      const record = value as Record<string, unknown>;
      const conflictValue = record[onConflict];
      const existingIndex = mutableTable.findIndex((row) => row[onConflict] === conflictValue);
      const nextRecord = {
        ...(existingIndex >= 0 ? mutableTable[existingIndex] : { id: record.id || createId(state.table), created_at: nowIso() }),
        ...record,
        updated_at: nowIso(),
      };
      if (existingIndex >= 0) {
        mutableTable[existingIndex] = nextRecord;
      } else {
        mutableTable.push(nextRecord);
      }
      return nextRecord;
    });
    writeJsonStorage(LOCAL_DB_KEY, database);
    return { data: upserted.length === 1 ? upserted[0] : upserted, error: null, count: upserted.length };
  }

  if (state.operation === 'update') {
    const matches = applyFilters(mutableTable, state.filters);
    const updated = matches.map((row) => {
      const nextRow = { ...row, ...(state.values as Record<string, unknown>), updated_at: nowIso() };
      const rowIndex = mutableTable.findIndex((entry) => entry.id === row.id);
      if (rowIndex >= 0) mutableTable[rowIndex] = nextRow;
      return nextRow;
    });
    writeJsonStorage(LOCAL_DB_KEY, database);
    return { data: updated, error: null, count: updated.length };
  }

  if (state.operation === 'delete') {
    const matches = applyFilters(mutableTable, state.filters);
    mutableDatabase[state.table] = mutableTable.filter((row) => !matches.some((match) => match.id === row.id));
    writeJsonStorage(LOCAL_DB_KEY, database);
    return { data: matches, error: null, count: matches.length };
  }

  return { data: null, error: null, count: null };
}

async function postJson<T>(path: string, payload: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(`${RENDER_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      Authorization: readStoredSession()?.access_token ? `Bearer ${readStoredSession()?.access_token}` : '',
    },
    body: JSON.stringify(payload),
    ...init,
  });

  return response.json();
}

class RenderQueryBuilder implements PromiseLike<{ data: any; error: Error | null; count?: number | null }> {
  private state: QueryState;

  constructor(table: string) {
    this.state = {
      table,
      operation: 'select',
      filters: [],
      orderBy: [],
    };
  }

  select(columns = '*', options?: Record<string, unknown>) {
    this.state.operation = 'select';
    this.state.select = columns;
    this.state.options = options;
    return this;
  }

  insert(values: unknown, options?: Record<string, unknown>) {
    this.state.operation = 'insert';
    this.state.values = values;
    this.state.options = options;
    return this;
  }

  update(values: unknown, options?: Record<string, unknown>) {
    this.state.operation = 'update';
    this.state.values = values;
    this.state.options = options;
    return this;
  }

  delete(options?: Record<string, unknown>) {
    this.state.operation = 'delete';
    this.state.options = options;
    return this;
  }

  upsert(values: unknown, options?: Record<string, unknown>) {
    this.state.operation = 'upsert';
    this.state.values = values;
    this.state.options = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.state.filters.push({ column, operator: 'neq', value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.state.filters.push({ column, operator: 'in', value });
    return this;
  }

  or(expression: string) {
    const filters = parseOrFilterExpression(expression);
    if (filters.length) {
      this.state.filters.push({ column: '__or__', operator: 'or', value: filters });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orderBy.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.state.limit = value;
    return this;
  }

  range(from: number, to: number) {
    this.state.range = { from, to };
    return this;
  }

  single() {
    this.state.single = true;
    return this;
  }

  maybeSingle() {
    this.state.maybeSingle = true;
    return this;
  }

  then<TResult1 = { data: any; error: Error | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: Error | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      const response = await postJson<{ data?: any; error?: { message?: string }; count?: number | null }>(
        '/db/query',
        this.state,
      );

      const error = response.error ? new Error(response.error.message || 'Render DB request failed') : null;
      if (shouldUseLocalFallback(error)) {
        return runLocalQuery(this.state);
      }

      return {
        data: response.data ?? null,
        error,
        count: response.count ?? null,
      };
    } catch {
      return runLocalQuery(this.state);
    }
  }
}

const auth = {
  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.add(callback);
    queueMicrotask(() => callback('INITIAL_SESSION', readStoredSession()));

    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          },
        },
      },
    };
  },

  async getSession() {
    return { data: { session: readStoredSession() }, error: null };
  },

  async getUser() {
    return { data: { user: readStoredSession()?.user ?? null }, error: null };
  },

  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const response = await postJson<{ data?: any; error?: { message?: string } }>('/auth/sign-in', credentials);
      const error = response.error ? new Error(response.error.message || 'Render sign-in failed') : null;
      if (shouldUseLocalFallback(error)) {
        return localSignIn(credentials);
      }
      const session = response.data?.session ?? null;
      if (session) {
        writeStoredSession(session, 'SIGNED_IN');
      }
      return {
        data: response.data ?? null,
        error,
      };
    } catch {
      return localSignIn(credentials);
    }
  },

  async signUp(payload: { email: string; password: string; options?: Record<string, unknown> }) {
    try {
      const response = await postJson<{ data?: any; error?: { message?: string } }>('/auth/sign-up', payload);
      const error = response.error ? new Error(response.error.message || 'Render sign-up failed') : null;
      if (shouldUseLocalFallback(error)) {
        return localSignUp(payload);
      }
      const session = response.data?.session ?? null;
      if (session) {
        writeStoredSession(session, 'SIGNED_UP');
      }
      return {
        data: response.data ?? null,
        error,
      };
    } catch {
      return localSignUp(payload);
    }
  },

  async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
    try {
      const redirectTarget = new URL(`${RENDER_API_URL}/auth/oauth/${provider}`);
      if (options?.redirectTo) {
        redirectTarget.searchParams.set('redirectTo', options.redirectTo);
      }
      window.location.assign(redirectTarget.toString());
      return { data: { redirected: true }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error('Render OAuth failed') };
    }
  },

  async signOut() {
    writeStoredSession(null, 'SIGNED_OUT');
    try {
      await postJson('/auth/sign-out', {});
    } catch {
      // Local session was already cleared.
    }
    return { error: null };
  },

  async setSession(tokens: RenderSession) {
    writeStoredSession(tokens, 'TOKEN_REFRESHED');
    return { data: { session: tokens }, error: null };
  },

  async updateUser(payload: Record<string, unknown>) {
    try {
      const response = await postJson<{ data?: any; error?: { message?: string } }>('/auth/update-user', payload);
      const error = response.error ? new Error(response.error.message || 'Render update user failed') : null;
      if (shouldUseLocalFallback(error)) {
        return localUpdateUser(payload);
      }
      const nextSession = response.data?.session ?? readStoredSession();
      if (nextSession) {
        writeStoredSession(nextSession, 'USER_UPDATED');
      }
      return {
        data: response.data ?? null,
        error,
      };
    } catch {
      return localUpdateUser(payload);
    }
  },

  async resetPasswordForEmail(email: string, options?: Record<string, unknown>) {
    try {
      const response = await postJson<{ data?: any; error?: { message?: string } }>('/auth/reset-password', { email, options });
      return {
        data: response.data ?? null,
        error: response.error ? new Error(response.error.message || 'Render reset password failed') : null,
      };
    } catch {
      return {
        data: { sent: true },
        error: null,
      };
    }
  },
};

const functions = {
  async invoke(name: string, options?: { body?: unknown; headers?: Record<string, string> }) {
    try {
      const response = await fetch(`${RENDER_API_URL}/functions/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
          Authorization: readStoredSession()?.access_token ? `Bearer ${readStoredSession()?.access_token}` : '',
        },
        body: JSON.stringify(options?.body ?? {}),
      });

      const payload = await response.json();
      return {
        data: payload.data ?? payload,
        error: response.ok ? null : new Error(payload.error || `Render function ${name} failed`),
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(`Render function ${name} failed`),
      };
    }
  },
};

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File | Blob, options?: Record<string, unknown>) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', path);
          formData.append('bucket', bucket);
          formData.append('options', JSON.stringify(options || {}));

          const response = await fetch(`${RENDER_STORAGE_URL}/upload`, {
            method: 'POST',
            headers: {
              Authorization: readStoredSession()?.access_token ? `Bearer ${readStoredSession()?.access_token}` : '',
            },
            body: formData,
          });

          const payload = await response.json();
          return {
            data: payload.data ?? null,
            error: response.ok ? null : new Error(payload.error || 'Render storage upload failed'),
          };
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error : new Error('Render storage upload failed'),
          };
        }
      },

      getPublicUrl(path: string) {
        return {
          data: {
            publicUrl: `${RENDER_STORAGE_URL}/public/${encodeURIComponent(bucket)}/${path}`,
          },
        };
      },

      async remove(paths: string[]) {
        try {
          const response = await postJson<{ error?: { message?: string }; data?: unknown }>(
            '/storage/remove',
            { bucket, paths },
          );
          return {
            data: response.data ?? null,
            error: response.error ? new Error(response.error.message || 'Render storage remove failed') : null,
          };
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error : new Error('Render storage remove failed'),
          };
        }
      },
    };
  },
};

type ChannelHandler = {
  event: string;
  schema?: string;
  table?: string;
  filter?: string;
  callback: (payload: any) => void;
};

class RenderChannel {
  private readonly name: string;
  private handlers: ChannelHandler[] = [];
  private pollingId: number | null = null;
  private lastSnapshots = new Map<string, Map<string, Record<string, any>>>();

  constructor(name: string) {
    this.name = name;
  }

  on(_type: string, config: Omit<ChannelHandler, 'callback'>, callback: (payload: any) => void) {
    this.handlers.push({ ...config, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    callback?.('SUBSCRIBED');
    void this.startPolling();
    return {
      unsubscribe: () => this.stop(),
    };
  }

  getName() {
    return this.name;
  }

  stop() {
    if (this.pollingId !== null) {
      window.clearInterval(this.pollingId);
      this.pollingId = null;
    }
    this.lastSnapshots.clear();
  }

  private async startPolling() {
    await this.pollOnce(true);
    this.pollingId = window.setInterval(() => {
      void this.pollOnce(false);
    }, 3000);
  }

  private async pollOnce(primeOnly: boolean) {
    for (const handler of this.handlers) {
      if (!handler.table) continue;

      const state: QueryState = {
        table: handler.table,
        operation: 'select',
        select: '*',
        filters: parseChannelFilter(handler.filter),
        orderBy: [],
      };

      try {
        const response = await postJson<{ data?: any[] }>('/db/query', state);
        const rows = Array.isArray(response.data) ? response.data : [];
        const snapshotKey = `${handler.table}:${handler.event}:${handler.filter || ''}`;
        const previous = this.lastSnapshots.get(snapshotKey) || new Map<string, Record<string, any>>();
        const next = new Map<string, Record<string, any>>();

        for (const row of rows) {
          const rowKey = String(row.id ?? JSON.stringify(row));
          next.set(rowKey, row);

          if (primeOnly) continue;

          if (handler.event === 'INSERT' && !previous.has(rowKey)) {
            handler.callback({ eventType: 'INSERT', new: row, old: null } satisfies ChannelPayload);
            continue;
          }

          if (handler.event === 'UPDATE' && previous.has(rowKey)) {
            const oldRow = previous.get(rowKey)!;
            if (JSON.stringify(oldRow) !== JSON.stringify(row)) {
              handler.callback({ eventType: 'UPDATE', new: row, old: oldRow } satisfies ChannelPayload);
            }
          }
        }

        this.lastSnapshots.set(snapshotKey, next);
      } catch {
        // Ignore transient polling failures in compatibility mode.
      }
    }
  }
}

function parseChannelFilter(filter?: string): QueryState['filters'] {
  if (!filter) return [];

  const match = filter.match(/^([^=]+)=([a-z]+)\.(.+)$/i);
  if (!match) return [];

  const [, column, operator, value] = match;
  if (!['eq', 'neq'].includes(operator)) return [];

  return [{ column, operator, value }];
}

export const supabase: Database & any = {
  auth,
  functions,
  storage,
  async rpc(name: string, args?: Record<string, unknown>) {
    try {
      const response = await remoteRpc(name, args);
      if (shouldUseLocalFallback(response.error)) {
        return localRpc(name, args);
      }
      return response;
    } catch {
      return localRpc(name, args);
    }
  },
  from(table: string) {
    return new RenderQueryBuilder(table);
  },
  channel(name: string) {
    return new RenderChannel(name);
  },
  removeChannel(channel?: RenderChannel) {
    channel?.stop();
    return undefined;
  },
};