import { Hono } from "hono";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);
const backupRoute = new Hono();

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

    // Chama o binário real do PGDG (não o wrapper Perl /usr/bin/pg_dump).
    // Railway: DATABASE_URL já inclui credenciais e sslmode.
    const pgDump = '/usr/lib/postgresql/18/bin/pg_dump';
    const { stderr } = await execPromise(
      `"${pgDump}" "${dbUrl}" | gzip > "${filePath}"`,
      { env: { ...process.env, PGSSLMODE: 'require' } }
    );
    if (stderr) console.warn(`[Backup] pg_dump stderr: ${stderr}`);

    // Arquivo vazio = pg_dump falhou (pipe oculta o exit code)
    const stat = fs.statSync(filePath);
    if (stat.size < 200) {
      fs.unlinkSync(filePath);
      const hint = stderr || 'pg_dump retornou vazio. Verifique DATABASE_URL e conectividade.';
      return c.json({ error: 'Backup falhou — arquivo vazio gerado.', details: hint }, 500);
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