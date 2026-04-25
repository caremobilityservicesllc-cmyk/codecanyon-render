import { query, pool } from '../db.js';

const REMOTE_QUERY_URL = 'https://codecanyon-render.onrender.com/api/render/db/query';
const IMPORT_NOTE = 'Imported from LICENCE folder on 2026-04-24; license-only seed with availability disabled pending phone/onboarding completion.';

const drivers = [
  { first_name: 'Alex Antonio', last_name: 'Almanzar', license_number: 'A612-790-10-500-0', license_expiry: '2031-01-26' },
  { first_name: 'Balbino', last_name: 'Perez Rey', license_number: 'P222-260-38-400-0', license_expiry: '2033-07-19' },
  { first_name: 'Jose Luis', last_name: 'Batlle Castro', license_number: 'B239-733-23-000-0', license_expiry: '2031-02-15' },
  { first_name: 'Daniel', last_name: 'Fernandez Olivert', license_number: 'F655-160-67-293-0', license_expiry: '2031-08-13' },
  { first_name: 'Yiseker', last_name: 'Dieguez', license_number: 'D224-428-58-000-0', license_expiry: '2030-05-12' },
  { first_name: 'Ernesto Miguel', last_name: 'Llambia Rodriguez', license_number: 'L516-213-72-383-0', license_expiry: '2030-10-23' },
  { first_name: 'Fernando Sr', last_name: 'Fernandez', license_number: 'F655-245-60-181-0', license_expiry: '2027-05-21' },
  { first_name: 'Francisco', last_name: 'Ledoux Ovies', license_number: 'L606-452-34-100-0', license_expiry: '2029-03-25' },
  { first_name: 'Gabriel', last_name: 'Cabrera', license_number: 'C220-516-14-300-0', license_expiry: '2030-03-06' },
  { first_name: 'Harold', last_name: 'Suarez Morell', license_number: 'S618-200-12-300-0', license_expiry: '2029-04-11' },
  { first_name: 'Indira', last_name: 'Avila Amaro', license_number: 'A145-400-88-524-0', license_expiry: '2033-01-24' },
  { first_name: 'Joel', last_name: 'Pozo Barrios', license_number: 'P216-420-66-104-0', license_expiry: '2027-03-24' },
  { first_name: 'Leandro Mariano', last_name: 'Diaz Moreno', license_number: 'D237-095-59-400-0', license_expiry: '2034-12-13' },
  { first_name: 'Lisvany', last_name: 'Nunez Fleites', license_number: 'N521-520-92-458-0', license_expiry: '2025-12-08' },
  { first_name: 'Orlando', last_name: 'Landeiro Valle', license_number: 'L536-640-72-007-0', license_expiry: '2027-01-07' },
  { first_name: 'Eleser', last_name: 'Perez Valdes', license_number: 'P611-068-06-900-0', license_expiry: '2028-10-07' },
  { first_name: 'Ricardo', last_name: 'Diaz Gonzalez', license_number: 'D219-389-87-800-0', license_expiry: '2032-08-11' },
  { first_name: 'Yordanis', last_name: 'Roman Torres', license_number: 'R227-598-73-800-0', license_expiry: '2028-04-30' },
  { first_name: 'Sergio Julian', last_name: 'Flores Galvez', license_number: 'F612-344-79-100-0', license_expiry: '2026-03-28' },
  { first_name: 'Yanelis', last_name: 'Hernandez Milan', license_number: 'H620-196-59-900-0', license_expiry: '2025-05-01' },
  { first_name: 'Yosbeny', last_name: 'Torres Mesa', license_number: 'T617-041-43-300-0', license_expiry: '2025-12-04' },
  { first_name: 'Felipe', last_name: 'Gonzalez Raciel', license_number: 'F625-231-82-500-0', license_expiry: '2028-12-16' },
].map((driver) => ({
  ...driver,
  full_name: `${driver.first_name} ${driver.last_name}`.trim(),
}));

function buildVerificationNotes(existing) {
  if (!existing) {
    return IMPORT_NOTE;
  }

  if (existing.includes(IMPORT_NOTE)) {
    return existing;
  }

  return `${existing}\n${IMPORT_NOTE}`;
}

async function upsertLocalDriver(driver) {
  const existingResult = await query(
    `select id, verification_notes
     from drivers
     where license_number = $1
        or lower(full_name) = lower($2)
     limit 1`,
    [driver.license_number, driver.full_name],
  );

  const existing = existingResult.rows[0] || null;
  const verificationNotes = buildVerificationNotes(existing?.verification_notes || null);

  if (existing) {
    const result = await query(
      `update drivers
       set full_name = $1,
           first_name = $2,
           last_name = $3,
           license_number = $4,
           license_expiry = $5,
           is_active = true,
           verification_notes = $6,
           updated_at = now()
       where id = $7
       returning id, full_name, license_number, license_expiry, is_active, is_available`,
      [
        driver.full_name,
        driver.first_name,
        driver.last_name,
        driver.license_number,
        driver.license_expiry,
        verificationNotes,
        existing.id,
      ],
    );

    return { mode: 'updated', record: result.rows[0] };
  }

  const result = await query(
    `insert into drivers (
      full_name,
      first_name,
      last_name,
      phone,
      email,
      license_number,
      license_expiry,
      is_active,
      is_available,
      documents_verified,
      onboarding_status,
      background_check_status,
      verification_notes
    )
    values ($1, $2, $3, null, null, $4, $5, true, false, false, 'pending', 'pending', $6)
    returning id, full_name, license_number, license_expiry, is_active, is_available`,
    [
      driver.full_name,
      driver.first_name,
      driver.last_name,
      driver.license_number,
      driver.license_expiry,
      verificationNotes,
    ],
  );

  return { mode: 'inserted', record: result.rows[0] };
}

async function remoteQuery(body) {
  const response = await fetch(REMOTE_QUERY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.error || `Remote query failed with ${response.status}`);
  }

  return payload;
}

async function upsertRemoteDriver(driver) {
  const existingResponse = await remoteQuery({
    table: 'drivers',
    operation: 'select',
    select: 'id,verification_notes',
    filters: [
      {
        operator: 'or',
        value: [
          { column: 'license_number', operator: 'eq', value: driver.license_number },
          { column: 'full_name', operator: 'eq', value: driver.full_name },
        ],
      },
    ],
    limit: 1,
  });

  const existing = Array.isArray(existingResponse.data) ? existingResponse.data[0] : existingResponse.data;
  const verificationNotes = buildVerificationNotes(existing?.verification_notes || null);

  if (existing?.id) {
    const result = await remoteQuery({
      table: 'drivers',
      operation: 'update',
      filters: [{ column: 'id', operator: 'eq', value: existing.id }],
      values: {
        full_name: driver.full_name,
        first_name: driver.first_name,
        last_name: driver.last_name,
        license_number: driver.license_number,
        license_expiry: driver.license_expiry,
        is_active: true,
        verification_notes: verificationNotes,
        updated_at: new Date().toISOString(),
      },
    });

    return { mode: 'updated', record: Array.isArray(result.data) ? result.data[0] : result.data };
  }

  const result = await remoteQuery({
    table: 'drivers',
    operation: 'insert',
    values: {
      full_name: driver.full_name,
      first_name: driver.first_name,
      last_name: driver.last_name,
      phone: null,
      email: null,
      license_number: driver.license_number,
      license_expiry: driver.license_expiry,
      is_active: true,
      is_available: false,
      documents_verified: false,
      onboarding_status: 'pending',
      background_check_status: 'pending',
      verification_notes: verificationNotes,
    },
  });

  return { mode: 'inserted', record: result.data };
}

async function runLocalImport() {
  const summary = { inserted: 0, updated: 0 };
  for (const driver of drivers) {
    const result = await upsertLocalDriver(driver);
    summary[result.mode] += 1;
  }

  const countResult = await query(
    `select count(*)::int as count
     from drivers
     where verification_notes ilike $1`,
    ['%Imported from LICENCE folder on 2026-04-24%'],
  );

  return {
    ...summary,
    totalImportedSet: countResult.rows[0]?.count || 0,
  };
}

async function runRemoteImport() {
  const summary = { inserted: 0, updated: 0 };
  for (const driver of drivers) {
    const result = await upsertRemoteDriver(driver);
    summary[result.mode] += 1;
  }

  const countResult = await remoteQuery({
    table: 'drivers',
    operation: 'select',
    select: 'id',
    filters: [{ column: 'verification_notes', operator: 'ilike', value: '%Imported from LICENCE folder on 2026-04-24%' }],
  });

  const totalImportedSet = Array.isArray(countResult.data) ? countResult.data.length : countResult.count || 0;
  return {
    ...summary,
    totalImportedSet,
  };
}

async function main() {
  const target = process.argv[2] || 'both';
  const results = {};

  if (target === 'local' || target === 'both') {
    results.local = await runLocalImport();
  }

  if (target === 'remote' || target === 'both') {
    results.remote = await runRemoteImport();
  }

  console.log(JSON.stringify({ target, drivers: drivers.length, results }, null, 2));
}

try {
  await main();
  await pool.end();
} catch (error) {
  console.error(error);
  await pool.end();
  process.exit(1);
}