import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import path from 'path';
import * as schema from './schema';

// Garante que a URL do Supabase/Neon seja lida ANTES de tentar conectar
config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/olympus';

const client = postgres(connectionString, { prepare: false, onnotice: () => {} });
export const db = drizzle(client, { schema });
