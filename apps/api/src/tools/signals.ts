import { db, weakSignals } from "@olympus/db";
import { eq, and } from "drizzle-orm";

// ── Schemas JSON puros (sem Zod) — R1/R2 do GUIA_WEAK_SIGNALS ───────────────

export const REGISTRAR_SCHEMA = {
  type: "object",
  properties: {
    titulo:              { type: "string", description: "Nome curto e memorável do sinal (máx. 80 chars)" },
    descricao:           { type: "string", description: "Descrição concisa do fragmento observado" },
    tipo:                { type: "string", enum: ["weak_signal","wild_card","tendencia","megatendencia"] },
    classificacao:       { type: "string", enum: ["confirmavel","ambiguo","ruido"], description: "Resultado do sensemaking" },
    origemFonte:         { type: "string", description: "Onde foi identificado" },
    tipoEvidencia:       { type: "string", enum: ["anedotico","fragmentado","padrao_emergente"] },
    porQueNovo:          { type: "string", description: "O que distingue das práticas correntes" },
    potencialDisruptivo: { type: "string", description: "O que poderia mudar se escalar" },
    atoresPortadores:    { type: "string", description: "Quem está na origem deste sinal" },
    janelaAnos:          { type: "string", enum: ["2-5","5-10","incerto"] },
    clusterId:           { type: "string", description: "ID para agrupar sinais relacionados" },
  },
  required: ["titulo", "descricao", "tipo", "classificacao"]
};

export const BUSCAR_SCHEMA = {
  type: "object",
  properties: {
    filtroClassificacao: {
      type: "array",
      items: { type: "string", enum: ["confirmavel","ambiguo","ruido"] },
    },
    filtroStatusRadar: {
      type: "array",
      items: { type: "string", enum: ["monitorando","amplificando","materializado"] },
    },
    incluirArquivados: { type: "boolean" }
  },
  required: []
};

export const ATUALIZAR_SENTINELA_SCHEMA = {
  type: "object",
  properties: {
    signalId:        { type: "string" },
    sentinela:       { type: "string", enum: ["1", "2"], description: "Índice do sentinela a atualizar (\"1\" ou \"2\")." },
    descricao:       { type: "string" },
    fonte:           { type: "string" },
    status:          { type: "string", enum: ["inativo","ativo","disparado"] },
    interpretacao:   { type: "string" },
    acaoRecomendada: { type: "string" },
    statusRadar:     { type: "string", enum: ["monitorando","amplificando","materializado","arquivado"] }
  },
  required: ["signalId", "sentinela", "status"]
};

// ── Factory de tools com projectId injetado ──────────────────────────────────
// Retorna Tool<any> puro (não usa tool() do AI SDK) — Agent.ts já faz o wrap.

export function createSignalTools(projectId: string) {

  const registrarSinal = {
    name: 'registrar_sinal',
    description: `Registra um weak signal, wild card, tendência ou megatendência durante a análise MSEF.
Uma chamada por sinal. Sinais 'ruido' são arquivados com justificativa.`,
    schema: REGISTRAR_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      try {
        const [inserted] = await db.insert(weakSignals).values({
          projectId,
          titulo:              args.titulo,
          descricao:           args.descricao,
          tipo:                args.tipo,
          classificacao:       args.classificacao,
          origemFonte:         args.origemFonte,
          tipoEvidencia:       args.tipoEvidencia,
          porQueNovo:          args.porQueNovo,
          potencialDisruptivo: args.potencialDisruptivo,
          atoresPortadores:    args.atoresPortadores,
          janelaAnos:          args.janelaAnos,
          clusterId:           args.clusterId,
          statusRadar:         args.classificacao === "ruido" ? "arquivado" : "monitorando",
          identificadoPor:     "KLIO",
        }).returning();
        return JSON.stringify({
          ok: true,
          id: inserted.id,
          titulo: inserted.titulo,
          classificacao: inserted.classificacao,
          statusRadar: inserted.statusRadar,
          mensagem: `Sinal registrado. ID: ${inserted.id}`
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, erro: e.message });
      }
    }
  };

  const buscarSinais = {
    name: 'buscar_sinais',
    description: `Busca weak signals registrados neste projeto.
Usar: PYTHIA selecionar eixos, THEMIS gerar Bloco G, KRATOS configurar sentinelas.`,
    schema: BUSCAR_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      const classificacoes = args.filtroClassificacao ?? ["confirmavel", "ambiguo"];
      const statusList     = args.filtroStatusRadar   ?? ["monitorando", "amplificando", "materializado"];

      const todos = await db.select().from(weakSignals)
        .where(eq(weakSignals.projectId, projectId));

      const filtrados = todos.filter((s: any) =>
        classificacoes.includes(s.classificacao) &&
        (args.incluirArquivados || s.statusRadar !== "arquivado") &&
        statusList.includes(s.statusRadar)
      );

      const stats = {
        total:         todos.length,
        confirmavel:   todos.filter((s: any) => s.classificacao === "confirmavel").length,
        ambiguo:       todos.filter((s: any) => s.classificacao === "ambiguo").length,
        ruido:         todos.filter((s: any) => s.classificacao === "ruido").length,
        amplificando:  todos.filter((s: any) => s.statusRadar === "amplificando").length,
        materializado: todos.filter((s: any) => s.statusRadar === "materializado").length,
      };

      return JSON.stringify({ sinais: filtrados, stats, total: filtrados.length });
    }
  };

  const atualizarSentinela = {
    name: 'atualizar_sentinela',
    description: `Atualiza o status de um sentinela de monitoramento. Usar pelo KRATOS.
Quando ambos sentinelas ficam 'disparado', emite Alerta de Amplificação.`,
    schema: ATUALIZAR_SENTINELA_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      const update: Record<string, any> = { updatedAt: new Date() };
      if (Number(args.sentinela) === 1) {
        if (args.descricao) update.sentinela1Descricao = args.descricao;
        if (args.fonte)     update.sentinela1Fonte     = args.fonte;
        update.sentinela1Status = args.status;
      } else {
        if (args.descricao) update.sentinela2Descricao = args.descricao;
        if (args.fonte)     update.sentinela2Fonte     = args.fonte;
        update.sentinela2Status = args.status;
      }
      if (args.interpretacao)   update.interpretacaoAtual = args.interpretacao;
      if (args.acaoRecomendada) update.acaoRecomendada    = args.acaoRecomendada;
      if (args.statusRadar)     update.statusRadar        = args.statusRadar;

      await db.update(weakSignals)
        .set(update)
        .where(and(
          eq(weakSignals.id, args.signalId),
          eq(weakSignals.projectId, projectId)
        ));

      const rows = await db.select().from(weakSignals).where(eq(weakSignals.id, args.signalId));
      const sinal = rows[0];

      const amplificando =
        sinal?.sentinela1Status === "disparado" &&
        sinal?.sentinela2Status === "disparado";

      if (amplificando && sinal?.statusRadar !== "amplificando") {
        await db.update(weakSignals)
          .set({ statusRadar: "amplificando", updatedAt: new Date() })
          .where(eq(weakSignals.id, args.signalId));
      }

      return JSON.stringify({
        ok: true,
        amplificando,
        alertaAmplificacao: amplificando
          ? `⚠️ ALERTA DE AMPLIFICAÇÃO: O sinal "${sinal?.titulo}" teve 2 sentinelas disparados.`
          : null,
        statusRadar: amplificando ? "amplificando" : sinal?.statusRadar
      });
    }
  };

  return { registrarSinal, buscarSinais, atualizarSentinela };
}
