import { Hono } from "hono";
import { db, weakSignals } from "@olympus/db";
import { eq } from "drizzle-orm";

const signalsRouter = new Hono();

// GET /api/v1/signals/:projectId
signalsRouter.get("/:projectId", async (c) => {
  const { projectId } = c.req.param();
  const { classificacao, status } = c.req.query();

  const todos = await db.select()
    .from(weakSignals)
    .where(eq(weakSignals.projectId, projectId));

  let filtrados = todos;
  if (classificacao) {
    const list = classificacao.split(",");
    filtrados = filtrados.filter(s => list.includes(s.classificacao));
  }
  if (status) {
    const list = status.split(",");
    filtrados = filtrados.filter(s => list.includes(s.statusRadar as string));
  }

  const stats = {
    total:        todos.length,
    confirmavel:  todos.filter(s => s.classificacao === "confirmavel").length,
    ambiguo:      todos.filter(s => s.classificacao === "ambiguo").length,
    ruido:        todos.filter(s => s.classificacao === "ruido").length,
    amplificando: todos.filter(s => s.statusRadar === "amplificando").length,
    materializado:todos.filter(s => s.statusRadar === "materializado").length,
  };

  return c.json({ sinais: filtrados, stats });
});

// PATCH /api/v1/signals/:id
signalsRouter.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const allowed = [
    "classificacao", "statusRadar", "interpretacaoAtual", "acaoRecomendada",
    "sentinela1Status", "sentinela2Status",
    "sentinela1Descricao", "sentinela1Fonte",
    "sentinela2Descricao", "sentinela2Fonte",
  ];
  const update: Record<string, any> = { updatedAt: new Date() };
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  await db.update(weakSignals)
    .set(update)
    .where(eq(weakSignals.id, id));

  return c.json({ ok: true });
});

export default signalsRouter;
