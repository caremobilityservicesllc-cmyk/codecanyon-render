import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:8080',
  databaseUrl: required('DATABASE_URL', ''),
  jwtSecret: required('RENDER_JWT_SECRET', 'rideflow-render-dev-secret-change-me'),
  autoApplySchema: process.env.RENDER_AUTO_APPLY_SCHEMA === 'true',
  adminIdentifiers: String(
    process.env.RENDER_BOOTSTRAP_ADMIN_IDENTIFIERS || 'robert,carlos,lexy,balbino',
  )
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};