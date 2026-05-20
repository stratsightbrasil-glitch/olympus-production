const fs = require('fs');
const path = require('path');

const destDir = path.join('D:', 'Pessoais', 'DEV', 'Olympus_v4', 'apps', 'api', 'src');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const destFile = path.join(destDir, 'cron.ts');
const code = `import cron from 'node-cron';
import { db, projects } from '@olympus/db';
import { eq } from 'drizzle-orm';

let activeJobs: Record<string, cron.ScheduledTask> = {};

export async function reloadCronJobs() {
  Object.values(activeJobs).forEach(job => job.stop());
  activeJobs = {};
  try {
    const ativos = await db.query.projects.findMany({ where: eq(projects.status, 'ativo') });
    ativos.forEach(p => {
      if (p.kratosCron && cron.validate(p.kratosCron)) {
        activeJobs[p.id] = cron.schedule(p.kratosCron, async () => {
          console.log(\`[KRATOS CRON] 🤖 Iniciando monitoramento automático para o projeto: \${p.name} (\${p.id})\`);
        });
        console.log(\`⏰ Automação agendada para [\${p.name}]: \${p.kratosCron}\`);
      }
    });
  } catch (err) { console.error('Erro ao recarregar crons:', err); }
}`;

fs.writeFileSync(destFile, code, 'utf-8');
console.log('✅ Arquivo cron.ts criado com SUCESSO em: ' + destFile);

// Remove o arquivo que o assistente criou na pasta errada
const wrongFile = path.join('D:', 'Pessoais', 'DEV', 'Olympus_v4', 'packages', 'db', 'src', 'cron.ts');
if (fs.existsSync(wrongFile)) {
  fs.unlinkSync(wrongFile);
  console.log('🗑️ Arquivo errado apagado: ' + wrongFile);
}
