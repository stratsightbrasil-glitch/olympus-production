// Rate limiting em memória por userId — adequado para instância única (Railway/Docker).
// Para multi-instância futura: substituir pelo Redis + sliding window.

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

function check(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// Limpeza periódica para evitar leak de memória em sessões longas
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 5 * 60 * 1000);

// 5 análises simultâneas por usuário por hora
export function rateLimitAnalysis(c: any, next: any) {
  const payload = c.get('jwtPayload');
  const key = `analysis:${payload?.id || c.req.header('x-forwarded-for') || 'anon'}`;
  if (!check(key, 5, 60 * 60 * 1000)) {
    return c.json({ error: 'Limite de análises atingido (5/hora). Aguarde antes de iniciar nova análise.' }, 429);
  }
  return next();
}

// 10 exportações por usuário por hora
export function rateLimitExport(c: any, next: any) {
  const payload = c.get('jwtPayload');
  const key = `export:${payload?.id || c.req.header('x-forwarded-for') || 'anon'}`;
  if (!check(key, 10, 60 * 60 * 1000)) {
    return c.json({ error: 'Limite de exportações atingido (10/hora). Aguarde antes de exportar novamente.' }, 429);
  }
  return next();
}
