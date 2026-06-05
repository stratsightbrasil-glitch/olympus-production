import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';

async function run() {
  const result = await db.execute(sql`DELETE FROM rate_limit_logs WHERE action = 'analysis'`);
  console.log('[clear_rate_limits] ✅ rate_limit_logs[analysis] limpos');
  process.exit(0);
}

run().catch(e => { console.error('[clear_rate_limits] ❌', e.message); process.exit(1); });
