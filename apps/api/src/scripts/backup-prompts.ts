import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '../../../../.env') });

import { db, agents } from '@olympus/db';
import fs from 'fs';

async function main() {
const all = await db.select({
  name: agents.name,
  role: agents.role,
  type: agents.type,
  systemPrompt: agents.systemPrompt,
  toolsConfig: agents.toolsConfig,
}).from(agents);

const outPath = path.resolve(process.cwd(), 'prompts_backup_sprint2.json');
fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
console.log(`Backup: ${all.length} agentes salvos em ${outPath}`);
process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
