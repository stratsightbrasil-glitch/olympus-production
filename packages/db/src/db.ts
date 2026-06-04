import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import path from 'path';
import * as schema from './schema';

// Garante que a URL do Supabase/Neon seja lida ANTES de tentar conectar
config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/olympus';

// Pool explícito — sem definir max, postgres.js usa 10 por padrão mas não documenta.
// idle_timeout: fechar conexões ociosas após 30s (Railway cobra por conexão aberta).
// connect_timeout: falhar rápido em vez de travar o processo.
const client = postgres(connectionString, {
  prepare:         false,
  onnotice:        () => {},
  max:             10,
  idle_timeout:    30,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
