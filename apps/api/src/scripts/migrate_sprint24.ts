/**
 * migrate_sprint24.ts — Adiciona colunas Sprint 24 a methodology_phases
 * Seguro para rodar múltiplas vezes (IF NOT EXISTS).
 */
import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('[migrate_sprint24] Aplicando migration...');
  await db.execute(sql`
    ALTER TABLE methodology_phases
      ADD COLUMN IF NOT EXISTS system_prompt_inject       TEXT,
      ADD COLUMN IF NOT EXISTS allowed_tools              JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS requires_hitl_before       BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS requires_qualitative_audit BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS ats_codes                  JSONB NOT NULL DEFAULT '[]'
  `);
  console.log('[migrate_sprint24] ✅ Colunas adicionadas (ou já existiam)');
  process.exit(0);
}

migrate().catch(e => { console.error('[migrate_sprint24] ❌', e.message); process.exit(1); });
