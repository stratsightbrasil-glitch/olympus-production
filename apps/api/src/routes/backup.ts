import { Hono } from "hono";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const backupRoute = new Hono();

/**
 * Executa pg_dump + gzip via spawn() com array de argumentos — nunca via shell string.
 * Usar exec() com interpolação de strings expõe injection se DATABASE_URL contiver
 * metacaracteres de shell. spawn() com array não passa por /bin/sh.
 */
function runPgDump(pgDump: string, dbUrl: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const pg = spawn(pgDump, [dbUrl], { stdio: ['ignore', 'pipe', 'pipe'] });
    const gz = spawn('gzip', [], { stdio: [pg.stdout as any, 'pipe', 'pipe'] });
    const out = fs.createWriteStream(outPath);

    gz.stdout.pipe(out);

    let stderrPg = '', stderrGz = '';
    pg.stderr.on('data', (d: Buffer) => { stderrPg += d.toString(); });
    gz.stderr.on('data', (d: Buffer) => { stderrGz += d.toString(); });

    out.on('finish', () => {
      if (stderrPg) console.warn(`[Backup] pg_dump stderr: ${stderrPg}`);
      if (stderrGz) console.warn(`[Backup] gzip stderr: ${stderrGz}`);
      resolve();
    });

    pg.on('error', reject);
    gz.on('error', reject);
    out.on('error', reject);
  });
}

// Apenas administradores podem gerar e listar backups
backupRoute.use('*', async (c, next) => {
  const payload = c.get('jwtPayload') as any;
  if (!payload || payload.role !== 'admin') {
    return c.json({ error: 'Acesso negado. Apenas Administradores podem acessar backups.' }, 403);
  }
  await next();
});

// Garante que a pasta de backups exista
const BACKUP_DIR = path.join(process.cwd(), "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

backupRoute.post("/generate", async (c) => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return c.json({ error: "DATABASE_URL não configurada no servidor." }, 400);
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `olympus_backup_${dateStr}.sql.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    console.log(`[Backup] Gerando backup: ${fileName}...`);
    const pgDump = '/usr/lib/postgresql/18/bin/pg_dump';
    await runPgDump(pgDump, dbUrl, filePath);

    // Arquivo vazio = pg_dump falhou (pipe oculta o exit code)
    const stat = fs.statSync(filePath);
    if (stat.size < 200) {
      fs.unlinkSync(filePath);
      return c.json({ error: 'Backup falhou — arquivo vazio gerado. Verifique DATABASE_URL e conectividade.' }, 500);
    }

    console.log(`[Backup] Concluído: ${filePath} (${stat.size} bytes)`);
    return c.json({ success: true, fileName, message: "Backup gerado com sucesso!" });
  } catch (error: any) {
    console.error("[Backup] Erro ao gerar backup:", error);
    return c.json({ error: "Falha ao gerar backup", details: error.message }, 500);
  }
});

backupRoute.get("/download/:filename", async (c) => {
  try {
    const filename = c.req.param('filename');
    // Segurança: bloqueia path traversal
    if (!filename || filename.includes('/') || filename.includes('..') || !filename.endsWith('.sql.gz')) {
      return c.json({ error: 'Nome de arquivo inválido.' }, 400);
    }
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return c.json({ error: 'Arquivo não encontrado.' }, 404);
    }
    const data = fs.readFileSync(filePath);
    c.header('Content-Type', 'application/gzip');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Length', String(data.length));
    return c.body(data as any);
  } catch (error: any) {
    return c.json({ error: 'Falha ao baixar backup', details: error.message }, 500);
  }
});

backupRoute.get("/list", async (c) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((file) => file.endsWith(".sql.gz"))
      .map((file) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          name: file,
          size: (stats.size / 1024 / 1024).toFixed(2) + " MB", // Tamanho amigável
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Mais recentes primeiro

    return c.json({ backups: files });
  } catch (error: any) {
    return c.json({ error: "Falha ao listar backups", details: error.message }, 500);
  }
});

export default backupRoute;