// Ferramentas de Rigor Analítico — ICD 203 (ODNI, 2022)
// Base: McMahon, "Analytic Tradecraft Standards in an Age of AI" (Belfer Center/Harvard, 2024)
// Padrão: Tool<any> puro — sem AI SDK tool(), sem Zod (ver HISTORICO_MIGRACAO.md §8.1)

import { db } from "@olympus/db";
import { projectEvents } from "@olympus/db";

export const DECLARAR_JULGAMENTO_SCHEMA = {
  type: "object",
  properties: {
    informacaoBase: {
      type: "string",
      description: "INFORMAÇÃO: fatos verificáveis extraídos das fontes consultadas. Citar fonte e URL de cada afirmação factual."
    },
    premissas: {
      type: "array",
      items: { type: "string" },
      description: "PREMISSAS: suposições que sustentam o argumento quando há lacunas de informação."
    },
    julgamento: {
      type: "string",
      description: "JULGAMENTO: conclusão baseada na informação e premissas acima."
    },
    grauProbabilidade: {
      type: "string",
      enum: [
        "remoto (01-05%)",
        "altamente improvável (05-20%)",
        "improvável (20-45%)",
        "aproximadamente igual (45-55%)",
        "provável (55-80%)",
        "altamente provável (80-95%)",
        "quase certo (95-99%)"
      ],
      description: "Grau de probabilidade — escala padronizada ICD 203 ATS 2"
    },
    nivelConfianca: {
      type: "string",
      enum: ["alta confiança", "confiança moderada", "baixa confiança"],
      description: "Confiança na base evidente — separado da probabilidade (ICD 203)"
    },
    indicadoresDeAlteracao: {
      type: "array",
      items: { type: "string" },
      description: "Indicadores que, se detectados, alterariam este julgamento (ICD 203 ATS 3)"
    },
    premissaLinchpin: {
      type: "string",
      description: "Premissa cuja ausência colapsa o argumento (ICD 203 ATS 3)"
    },
    contextoAnalise: {
      type: "string",
      description: "Etapa ou seção onde este julgamento se insere (ex: 'Etapa 2 - Driver X')"
    }
  },
  required: ["informacaoBase", "premissas", "julgamento", "grauProbabilidade", "nivelConfianca"]
};

export const HIPOTESE_ALTERNATIVA_SCHEMA = {
  type: "object",
  properties: {
    hipotesePrincipal: { type: "string", description: "A hipótese principal (julgamento preferencial)" },
    alternativas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          descricao:     { type: "string" },
          premissas:     { type: "array", items: { type: "string" } },
          probabilidade: {
            type: "string",
            enum: ["remoto (01-05%)","altamente improvável (05-20%)","improvável (20-45%)","aproximadamente igual (45-55%)","provável (55-80%)","altamente provável (80-95%)","quase certo (95-99%)"]
          },
          pontosFracosVsHipotesePrincipal: { type: "string" },
          indicadoresDeAtivacao: { type: "array", items: { type: "string" } }
        },
        required: ["descricao", "probabilidade", "pontosFracosVsHipotesePrincipal"]
      },
      description: "Pelo menos 1 hipótese alternativa plausível (ICD 203 ATS 4)"
    },
    racionalRejeicao: { type: "string", description: "Por que a hipótese principal é mais persuasiva" }
  },
  required: ["hipotesePrincipal", "alternativas", "racionalRejeicao"]
};

export const AVALIAR_FONTE_SCHEMA = {
  type: "object",
  properties: {
    url:         { type: "string" },
    titulo:      { type: "string" },
    tipo: {
      type: "string",
      enum: ["primaria_oficial","academica_revisada","midia_referencia","think_tank","industria","midia_nicho","desconhecida"]
    },
    dataPublicacao: { type: "string" },
    fidelidadeAoDocumento: {
      type: "string",
      enum: ["citacao_direta","parafraseada_fiel","inferida","extrapolada"]
    },
    possibilidadeNeD: { type: "boolean" },
    informacaoUsada: { type: "string" },
    avaliacaoCredibilidade: {
      type: "string",
      enum: ["alta","moderada","baixa","indeterminada"]
    },
    notas: { type: "string" }
  },
  required: ["url", "tipo", "fidelidadeAoDocumento", "informacaoUsada", "avaliacaoCredibilidade"]
};

// ── Factory de tools com projectId ──────────────────────────────────────────

export function createAnalyticStandardsTools(projectId: string) {

  const declararJulgamento = {
    name: 'declarar_julgamento',
    description: `Declara um julgamento analítico formal conforme ICD 203 ATS 3.
Usar sempre que emitir conclusão, avaliação ou previsão substantiva.
Separa explicitamente: INFORMAÇÃO (fatos das fontes) | PREMISSAS (suposições) | JULGAMENTO (conclusão).
Inclui grau de probabilidade e confiança conforme escala ICD 203 ATS 2.
NÃO usar para afirmações factuais simples.`,
    schema: DECLARAR_JULGAMENTO_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      const muitoSimilar = args.julgamento?.toLowerCase()
        .includes(args.informacaoBase?.toLowerCase().slice(0, 30));
      const temMuitasPremissas = (args.premissas || []).length >= 3;
      const avisoLinchpin = temMuitasPremissas && !args.premissaLinchpin
        ? "⚠️ 3+ premissas sem premissa-linchpin identificada — qual colapsa o argumento se falsa? (ICD 203 ATS 3)"
        : null;

      const formatoICD203 =
        `**[INFORMAÇÃO]** ${args.informacaoBase}\n\n` +
        `**[PREMISSAS]**\n${(args.premissas || []).map((p: string, i: number) => `${i+1}. ${p}`).join('\n')}\n\n` +
        `**[JULGAMENTO]** (${args.grauProbabilidade} | ${args.nivelConfianca}): ${args.julgamento}` +
        (args.premissaLinchpin ? `\n\n**[PREMISSA-LINCHPIN]** ${args.premissaLinchpin}` : '') +
        (args.indicadoresDeAlteracao?.length ? `\n\n**[INDICADORES DE ALTERAÇÃO]** ${args.indicadoresDeAlteracao.join('; ')}` : '');

      // Quando premissaLinchpin é declarada, persistir como project_event para que
      // ATHENA encontre "premissa-linchpin" nos keyFindings (ATS3 check).
      if (args.premissaLinchpin && projectId) {
        try {
          await db.insert(projectEvents).values({
            projectId,
            name: `Premissa-Linchpin: ${String(args.premissaLinchpin).substring(0, 200)}`,
            description: String(args.premissaLinchpin),
            type: 'uncertainty',
            status: 'proposed',
            sourceEvaluation: { factStatus: 'SUPOSICAO', reliability: 'C', credibility: '3' },
          });
        } catch { /* não bloquear execução se falhar */ }
      }

      return JSON.stringify({
        ok: true,
        formatoICD203,
        grauProbabilidade: args.grauProbabilidade,
        nivelConfianca:    args.nivelConfianca,
        contexto:          args.contextoAnalise || 'não especificado',
        avisos: [
          muitoSimilar ? "⚠️ Julgamento parece repetir a informação base — verifique se há inferência analítica real." : null,
          avisoLinchpin,
        ].filter(Boolean)
      });
    }
  };

  const registrarHipoteseAlternativa = {
    name: 'registrar_hipotese_alternativa',
    description: `Registra hipóteses alternativas formais conforme ICD 203 ATS 4.
Usar ao final de cada etapa que produza julgamentos sobre o futuro (PYTHIA, THEMIS).
Apresenta alternativas plausíveis com premissas, probabilidade e por que são menos persuasivas.`,
    schema: HIPOTESE_ALTERNATIVA_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      const formatoICD203 = (args.alternativas || []).map((alt: any, i: number) =>
        `**ALTERNATIVA ${i+1}** (${alt.probabilidade}): ${alt.descricao}\n` +
        `Premissas: ${(alt.premissas || []).join('; ') || 'não declaradas'}\n` +
        `Por que menos persuasiva: ${alt.pontosFracosVsHipotesePrincipal}\n` +
        `Indicadores de ativação: ${(alt.indicadoresDeAtivacao || []).join('; ') || 'não definidos'}`
      ).join('\n\n');

      return JSON.stringify({
        ok: true,
        hipotesePrincipal: args.hipotesePrincipal,
        totalAlternativas: (args.alternativas || []).length,
        racionalRejeicao:  args.racionalRejeicao,
        formatoICD203,
        aviso: (args.alternativas || []).length === 0
          ? "⚠️ ICD 203 ATS 4 exige pelo menos 1 hipótese alternativa plausível."
          : null
      });
    }
  };

  const avaliarFonte = {
    name: 'avaliar_fonte',
    description: `Avalia credibilidade e fidelidade de uma fonte consultada (ICD 203 ATS 1).
Usar para cada fonte relevante via web_search ou buscar_documentos_internos.
Permite rastrear e verificar a base evidental da análise (McMahon: replicability).`,
    schema: AVALIAR_FONTE_SCHEMA,
    execute: async (args: any, _ctx?: any): Promise<string> => {
      const alertas: string[] = [];
      if (args.tipo === 'desconhecida')                alertas.push("⚠️ Fonte de tipo desconhecido — credibilidade indeterminada");
      if (args.possibilidadeNeD)                        alertas.push("⚠️ Possibilidade de negação e deception — peso reduzido");
      if (args.fidelidadeAoDocumento === 'extrapolada') alertas.push("⚠️ Informação extrapolada — classificar como PREMISSA, não INFORMAÇÃO base");
      if (args.avaliacaoCredibilidade === 'baixa')      alertas.push("⚠️ Fonte de baixa credibilidade — usar apenas como corroboração");

      return JSON.stringify({
        ok: true,
        fonte: {
          url:                    args.url,
          titulo:                 args.titulo || '',
          tipo:                   args.tipo,
          dataPublicacao:         args.dataPublicacao || '',
          fidelidadeAoDocumento:  args.fidelidadeAoDocumento,
          possibilidadeNeD:       args.possibilidadeNeD || false,
          informacaoUsada:        args.informacaoUsada,
          avaliacaoCredibilidade: args.avaliacaoCredibilidade,
          notas:                  args.notas || ''
        },
        alertas,
        formatoICD203: `[${args.avaliacaoCredibilidade.toUpperCase()}] ${args.url} (${args.tipo}) — ${args.informacaoUsada}${args.notas ? ` [NOTA: ${args.notas}]` : ''}`
      });
    }
  };

  return { declararJulgamento, registrarHipoteseAlternativa, avaliarFonte };
}
