import { Hono } from 'hono';
import { db, indicators, weakSignals } from '@olympus/db';
import { eq, and } from 'drizzle-orm';

const indicatorsRoutes = new Hono();

type HistoryEntry = { date: string; value: number };

function appendHistory(existing: any, newValue: number | null | undefined): HistoryEntry[] {
  const history: HistoryEntry[] = Array.isArray(existing) ? existing : [];
  if (newValue == null || isNaN(Number(newValue))) return history;
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fresh = history.filter(e => e.date >= cutoff);
  fresh.push({ date: new Date().toISOString().slice(0, 10), value: Number(newValue) });
  return fresh;
}

async function autoRegisterSignal(projectId: string, indicatorName: string, status: string, value: number | null) {
  if (status !== 'amarelo' && status !== 'vermelho') return;
  const titulo = `Indicador ${status === 'vermelho' ? 'CRÍTICO' : 'em ATENÇÃO'}: ${indicatorName}`;
  const existing = await db.query.weakSignals.findFirst({
    where: and(eq(weakSignals.projectId, projectId), eq(weakSignals.titulo, titulo)),
  });
  if (existing) return;
  await db.insert(weakSignals).values({
    projectId,
    titulo,
    descricao: `Indicador "${indicatorName}" atingiu limiar ${status.toUpperCase()}. Valor atual: ${value ?? '—'}. Detectado automaticamente pelo sistema de monitoramento KRATOS.`,
    tipo: 'weak_signal',
    classificacao: status === 'vermelho' ? 'confirmavel' : 'ambiguo',
    statusRadar: status === 'vermelho' ? 'amplificando' : 'monitorando',
    identificadoPor: 'KRATOS',
    acaoRecomendada: `Investigar variação do indicador "${indicatorName}" e avaliar impacto nos cenários prospectivos.`,
  });
}

// Listar indicadores de um projeto (Usado pelo Painel e pelo KRATOS)
indicatorsRoutes.get('/project/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const list = await db.query.indicators.findMany({
      where: eq(indicators.projectId, projectId)
    });
    return c.json(list);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Criar ou atualizar indicadores (Usado pelo KRATOS após análise)
indicatorsRoutes.post('/', async (c) => {
  try {
    const body = (await c.req.json()) as any;
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      if (item.id) {
        const existing = await db.query.indicators.findFirst({ where: eq(indicators.id, item.id) });
        const prevStatus = existing?.status ?? 'verde';
        const newStatus  = item.status ?? prevStatus;
        const newHistory = appendHistory(existing?.valueHistory, item.ultimoValor);
        await db.update(indicators).set({
          name: item.name,
          source: item.fonte,
          status: newStatus,
          lastValue: item.ultimoValor,
          parametersJson: {
            yellowThreshold: item.limiarAmarelo,
            redThreshold: item.limiarVermelho
          },
          valueHistory: newHistory,
          lastCheckedAt: new Date()
        }).where(eq(indicators.id, item.id));
        // Auto-registrar sinal fraco se o status piorou
        if (prevStatus !== newStatus && (newStatus === 'amarelo' || newStatus === 'vermelho')) {
          await autoRegisterSignal(existing!.projectId, item.name, newStatus, item.ultimoValor);
        }
      } else {
        const newStatus = item.status || 'verde';
        const newHistory = appendHistory([], item.ultimoValor);
        await db.insert(indicators).values({
          projectId: item.projectId,
          name: item.name,
          source: item.fonte,
          status: newStatus,
          lastValue: item.ultimoValor,
          parametersJson: {
            yellowThreshold: item.limiarAmarelo,
            redThreshold: item.limiarVermelho
          },
          valueHistory: newHistory,
          lastCheckedAt: new Date()
        });
        // Auto-registrar sinal fraco na criação se já está em alerta
        if (newStatus === 'amarelo' || newStatus === 'vermelho') {
          await autoRegisterSignal(item.projectId, item.name, newStatus, item.ultimoValor);
        }
      }
    }

    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default indicatorsRoutes;
