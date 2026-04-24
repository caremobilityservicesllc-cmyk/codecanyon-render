import { query } from './db.js';

const ALLOWED_TABLES = new Set([
  'profiles',
  'bookings',
  'vehicles',
  'zones',
  'routes',
  'pricing_rules',
  'system_settings',
  'notifications',
  'promo_codes',
  'promo_code_uses',
  'drivers',
  'driver_documents',
  'driver_shifts',
  'driver_earnings',
  'driver_payouts',
  'driver_ratings',
  'page_content',
  'languages',
  'translation_overrides',
  'map_api_usage',
  'saved_locations',
  'favorite_vehicles',
  'loyalty_balances',
  'loyalty_points',
  'email_logs',
  'payment_methods',
  'push_subscriptions',
  'recurring_bookings',
  'ride_shares',
  'settings_audit_log',
]);

function buildClause(filter, values = []) {
  if (!filter?.column) return null;

  const column = `"${String(filter.column).replace(/"/g, '')}"`;
  if (filter.operator === 'eq') {
    values.push(filter.value);
    return `${column} = $${values.length}`;
  }

  if (filter.operator === 'neq') {
    values.push(filter.value);
    return `${column} <> $${values.length}`;
  }

  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    values.push(filter.value);
    return `${column} = any($${values.length})`;
  }

  if (filter.operator === 'ilike') {
    values.push(filter.value);
    return `${column} ilike $${values.length}`;
  }

  return null;
}

function matchesFilter(row, filter) {
  if (!filter?.column) return true;
  const value = row[filter.column];
  if (filter.operator === 'eq') return value === filter.value;
  if (filter.operator === 'neq') return value !== filter.value;
  if (filter.operator === 'in' && Array.isArray(filter.value)) return filter.value.includes(value);
  if (filter.operator === 'ilike') {
    const haystack = String(value ?? '').toLowerCase();
    const needle = String(filter.value ?? '').toLowerCase().replace(/%/g, '');
    return haystack.includes(needle);
  }
  return true;
}

function assertTable(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table not allowed: ${table}`);
  }
}

function parseSelect(select) {
  if (!select || select === '*') return '*';
  if (/[()]/.test(select) || /:/.test(select)) {
    return '*';
  }
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `"${part.replace(/"/g, '')}"`)
    .join(', ');
}

function buildWhere(filters = [], values = []) {
  const clauses = [];
  for (const filter of filters) {
    if (filter?.operator === 'or' && Array.isArray(filter.value)) {
      const orClauses = filter.value
        .map((entry) => buildClause(entry, values))
        .filter(Boolean);

      if (orClauses.length) {
        clauses.push(`(${orClauses.join(' or ')})`);
      }
      continue;
    }

    const clause = buildClause(filter, values);
    if (clause) clauses.push(clause);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function buildOrderBy(orderBy = []) {
  if (!orderBy.length) return '';
  const parts = orderBy
    .filter((item) => item?.column)
    .map((item) => `"${String(item.column).replace(/"/g, '')}" ${item.ascending === false ? 'desc' : 'asc'}`);
  return parts.length ? ` order by ${parts.join(', ')}` : '';
}

function parseSelectedColumns(select) {
  if (!select || select === '*') return null;
  if (/[()]/.test(select) || /:/.test(select)) return null;
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function pickColumns(row, columns) {
  if (!columns) return row;
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
}

function applyFilters(rows, filters = []) {
  return rows.filter((row) => filters.every((filter) => {
    if (filter?.operator === 'or' && Array.isArray(filter.value)) {
      return filter.value.some((entry) => matchesFilter(row, entry));
    }

    return matchesFilter(row, filter);
  }));
}

function applyOrder(rows, orderBy = []) {
  if (!orderBy.length) return rows;
  return [...rows].sort((left, right) => {
    for (const item of orderBy) {
      if (!item?.column) continue;
      const leftValue = left[item.column];
      const rightValue = right[item.column];
      if (leftValue === rightValue) continue;
      if (leftValue == null) return item.ascending === false ? 1 : -1;
      if (rightValue == null) return item.ascending === false ? -1 : 1;
      if (leftValue < rightValue) return item.ascending === false ? 1 : -1;
      if (leftValue > rightValue) return item.ascending === false ? -1 : 1;
    }
    return 0;
  });
}

function applyWindow(rows, state) {
  const offset = state.range ? Math.max(0, state.range.from) : 0;
  const limit = state.range
    ? Math.max(0, state.range.to - state.range.from + 1)
    : typeof state.limit === 'number'
      ? Math.max(0, state.limit)
      : null;
  return limit == null ? rows.slice(offset) : rows.slice(offset, offset + limit);
}

function isMissingRelation(error, relation) {
  return error?.code === '42P01' && (!relation || String(error.message || '').includes(`"${relation}"`));
}

function mapLegacyDriver(row) {
  const data = row.data || {};
  return {
    id: row.id,
    user_id: data.authUserId || row.id,
    full_name: data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' '),
    first_name: data.firstName || null,
    last_name: data.lastName || null,
    email: data.portalEmail || data.email || null,
    phone: data.phone || null,
    avatar_url: null,
    average_rating: null,
    total_rides: null,
    is_available: String(data.live || '').toLowerCase() === 'online',
    is_active: String(data.profileStatus || '').toLowerCase() === 'active',
    updated_at: row.updated_at,
  };
}

function mapLegacyBooking(row) {
  const data = row.data || {};
  const statusMap = {
    confirmed: 'confirmed',
    pending: 'pending',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    complete: 'completed',
    completed: 'completed',
    'in progress': 'confirmed',
  };
  const rawStatus = String(data.status || '').trim().toLowerCase();
  return {
    id: row.id,
    booking_reference: data.brokerTripId || data.rideId || row.broker_trip_id || row.id,
    pickup_location: data.address || null,
    dropoff_location: data.destination || null,
    pickup_date: row.service_date || data.serviceDate || null,
    pickup_time: data.pickup || data.scheduledPickup || data.rawPickupTime || null,
    vehicle_name: data.vehicleType || 'Assigned Vehicle',
    passengers: 1,
    status: statusMap[rawStatus] || 'pending',
    total_price: null,
    ride_started_at: data.actualPickup || null,
    ride_completed_at: data.actualDropoff || null,
    driver_id: data.driverId || null,
    updated_at: row.updated_at,
  };
}

async function executeLegacyDriversQuery(state) {
  if (state.operation === 'select') {
    const selectedColumns = parseSelectedColumns(state.select);
    const result = await query('select id, data, updated_at from admin_drivers');
    const filtered = applyFilters(result.rows.map(mapLegacyDriver), state.filters);
    const ordered = applyOrder(filtered, state.orderBy);
    const windowed = applyWindow(ordered, state);
    const data = windowed.map((row) => pickColumns(row, selectedColumns));
    return {
      data: state.single || state.maybeSingle ? (data[0] || null) : data,
      count: filtered.length,
      error: null,
    };
  }

  if (state.operation === 'update') {
    const idFilter = (state.filters || []).find((filter) => filter?.column === 'id' || filter?.column === 'user_id');
    if (!idFilter?.value) {
      throw new Error('Legacy driver updates require an id or user_id filter');
    }

    const target = await query(
      `select id, data, updated_at
       from admin_drivers
       where id = $1 or data->>'authUserId' = $1
       limit 1`,
      [String(idFilter.value)],
    );

    const current = target.rows[0];
    if (!current) {
      return { data: [], count: 0, error: null };
    }

    const nextData = { ...(current.data || {}) };
    if (typeof state.values?.is_available === 'boolean') {
      nextData.live = state.values.is_available ? 'Online' : 'Offline';
    }

    const updated = await query(
      `update admin_drivers
       set data = $2::jsonb,
           updated_at = now()
       where id = $1
       returning id, data, updated_at`,
      [current.id, JSON.stringify(nextData)],
    );

    return { data: updated.rows.map(mapLegacyDriver), count: updated.rowCount, error: null };
  }

  throw new Error(`Unsupported legacy drivers operation: ${state.operation}`);
}

async function executeLegacyBookingsQuery(state) {
  if (state.operation === 'select') {
    const selectedColumns = parseSelectedColumns(state.select);
    const result = await query('select id, service_date, broker_trip_id, data, updated_at from dispatch_trips');
    const filtered = applyFilters(result.rows.map(mapLegacyBooking), state.filters);
    const ordered = applyOrder(filtered, state.orderBy);
    const windowed = applyWindow(ordered, state);
    const data = windowed.map((row) => pickColumns(row, selectedColumns));
    return {
      data: state.single || state.maybeSingle ? (data[0] || null) : data,
      count: filtered.length,
      error: null,
    };
  }

  if (state.operation === 'update') {
    const idFilter = (state.filters || []).find((filter) => filter?.column === 'id');
    if (!idFilter?.value) {
      throw new Error('Legacy booking updates require an id filter');
    }

    const target = await query(
      `select id, service_date, broker_trip_id, data, updated_at
       from dispatch_trips
       where id = $1
       limit 1`,
      [String(idFilter.value)],
    );

    const current = target.rows[0];
    if (!current) {
      return { data: [], count: 0, error: null };
    }

    const nextData = { ...(current.data || {}) };
    if (typeof state.values?.status === 'string') {
      nextData.status = state.values.status === 'completed' ? 'Completed' : state.values.status;
    }
    if (typeof state.values?.ride_started_at === 'string') {
      nextData.actualPickup = state.values.ride_started_at;
      nextData.status = nextData.status || 'In Progress';
    }
    if (typeof state.values?.ride_completed_at === 'string') {
      nextData.actualDropoff = state.values.ride_completed_at;
      nextData.status = 'Completed';
    }

    const updated = await query(
      `update dispatch_trips
       set data = $2::jsonb,
           updated_at = now()
       where id = $1
       returning id, service_date, broker_trip_id, data, updated_at`,
      [current.id, JSON.stringify(nextData)],
    );

    return { data: updated.rows.map(mapLegacyBooking), count: updated.rowCount, error: null };
  }

  throw new Error(`Unsupported legacy bookings operation: ${state.operation}`);
}

export async function executeDbQuery(state) {
  assertTable(state.table);

  if (state.operation === 'select') {
    const values = [];
    const where = buildWhere(state.filters, values);
    const orderBy = buildOrderBy(state.orderBy);
    const limit = typeof state.limit === 'number' ? ` limit ${Math.max(0, state.limit)}` : '';
    const offset = state.range ? ` offset ${Math.max(0, state.range.from)}` : '';
    const rangeLimit = state.range ? ` limit ${Math.max(0, state.range.to - state.range.from + 1)}` : '';
    const select = parseSelect(state.select);
    try {
      const result = await query(`select ${select} from "${state.table}"${where}${orderBy}${state.range ? rangeLimit : limit}${offset}`.trim(), values);
      const data = state.single || state.maybeSingle ? (result.rows[0] || null) : result.rows;
      return { data, count: result.rowCount, error: null };
    } catch (error) {
      if (state.table === 'drivers' && isMissingRelation(error, 'drivers')) {
        return executeLegacyDriversQuery(state);
      }

      if (state.table === 'bookings' && isMissingRelation(error, 'bookings')) {
        return executeLegacyBookingsQuery(state);
      }

      throw error;
    }
  }

  if (state.operation === 'insert') {
    const rows = Array.isArray(state.values) ? state.values : [state.values];
    const inserted = [];
    for (const row of rows) {
      const entries = Object.entries(row || {});
      const columns = entries.map(([key]) => `"${key.replace(/"/g, '')}"`).join(', ');
      const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
      const values = entries.map(([, value]) => value);
      const result = await query(`insert into "${state.table}" (${columns}) values (${placeholders}) returning *`, values);
      inserted.push(result.rows[0]);
    }
    return { data: inserted.length === 1 ? inserted[0] : inserted, count: inserted.length, error: null };
  }

  if (state.operation === 'upsert') {
    const rows = Array.isArray(state.values) ? state.values : [state.values];
    const onConflict = String(state.options?.onConflict || 'id').replace(/"/g, '');
    const upserted = [];
    for (const row of rows) {
      const entries = Object.entries(row || {});
      const columns = entries.map(([key]) => `"${key.replace(/"/g, '')}"`).join(', ');
      const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
      const updates = entries
        .filter(([key]) => key !== onConflict)
        .map(([key]) => `"${key.replace(/"/g, '')}" = excluded."${key.replace(/"/g, '')}"`)
        .join(', ');
      const values = entries.map(([, value]) => value);
      const result = await query(
        `insert into "${state.table}" (${columns}) values (${placeholders}) on conflict ("${onConflict}") do update set ${updates} returning *`,
        values,
      );
      upserted.push(result.rows[0]);
    }
    return { data: upserted.length === 1 ? upserted[0] : upserted, count: upserted.length, error: null };
  }

  if (state.operation === 'update') {
    const values = [];
    const sets = Object.entries(state.values || {}).map(([key, value]) => {
      values.push(value);
      return `"${key.replace(/"/g, '')}" = $${values.length}`;
    });
    const where = buildWhere(state.filters, values);
    const result = await query(`update "${state.table}" set ${sets.join(', ')}${where} returning *`, values);
    return { data: result.rows, count: result.rowCount, error: null };
  }

  if (state.operation === 'delete') {
    const values = [];
    const where = buildWhere(state.filters, values);
    const result = await query(`delete from "${state.table}"${where} returning *`, values);
    return { data: result.rows, count: result.rowCount, error: null };
  }

  throw new Error(`Unsupported operation: ${state.operation}`);
}