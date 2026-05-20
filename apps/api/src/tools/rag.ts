import { Tool } from '@olympus/core';
import { db } from '@olympus/db';
import { sql } from 'drizzle-orm';
import { generateEmbedding } from '@olympus/tools';

export type RagArgs = {
  consulta: string;
  top_k?: number;
};

export const ragTool: Tool<RagArgs> = {
  name: 'buscar_documentos_internos',
  description: `Busca trechos relevantes de documentos internos indexados para o projeto atual usando similaridade semântica (RAG — Retrieval-Augmented Generation).
Use esta ferramenta quando o usuário mencionar documentos, relatórios, contratos, regulamentos ou qualquer conteúdo que possa ter sido enviado como arquivo.
Parâmetro "consulta": descreva o tema ou pergunta específica a pesquisar nos documentos.
Parâmetro "top_k": número de trechos a retornar (padrão 5, máximo 10).
Retorna os trechos mais relevantes com nome do arquivo e similaridade. Se não houver documentos indexados, informa claramente.`,
  schema: {
    type: 'object',
    properties: {
      consulta: {
        type: 'string',
        description: 'Tema ou pergunta a pesquisar nos documentos internos do projeto.',
      },
      top_k: {
        type: 'integer',
        description: 'Número de trechos a retornar (padrão 5, máximo 10).',
        default: 5,
        minimum: 1,
        maximum: 10,
      },
    },
    required: ['consulta'],
  },

  execute: async (args: RagArgs, context: any) => {
    const { consulta, top_k = 5 } = args;
    const projectId = context?.projectId;

    if (!projectId) return '⚠️ Contexto sem projectId — impossível buscar documentos.';

    console.log(`[RAG] Buscando "${consulta}" em projectId=${projectId}`);

    let queryVec: number[];
    try {
      queryVec = await generateEmbedding(consulta);
    } catch (e: any) {
      return `⚠️ RAG indisponível: ${e.message}`;
    }

    const vectorLiteral = `[${queryVec.join(',')}]`;
    const limit = Math.min(top_k, 10);

    // pgvector cosine distance (<=>): menor = mais similar
    const rows = await db.execute(sql`
      SELECT chunk_text, metadata, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM embeddings
      WHERE project_id = ${projectId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `);

    const results: any[] = Array.isArray(rows) ? rows : (rows as any).rows ?? [];

    if (results.length === 0) {
      return `[DOCUMENTOS INTERNOS] Nenhum documento indexado para este projeto. Para indexar, envie arquivos pela interface e eles serão processados automaticamente.`;
    }

    const linhas = [`[DOCUMENTOS INTERNOS — ${results.length} trechos relevantes para: "${consulta}"]`];
    results.forEach((row: any, i: number) => {
      const meta = row.metadata as any ?? {};
      const fonte = meta.filename ?? meta.source ?? 'documento';
      const sim = typeof row.similarity === 'number' ? (row.similarity * 100).toFixed(1) : '?';
      linhas.push(`\n[${i + 1}] ${fonte} (relevância: ${sim}%)\n${String(row.chunk_text).slice(0, 600)}`);
    });

    return linhas.join('\n');
  },
};
