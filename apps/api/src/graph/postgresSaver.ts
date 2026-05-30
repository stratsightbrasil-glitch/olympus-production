/**
 * postgresSaver.ts — Singleton async do PostgresSaver (LangGraph checkpointer).
 *
 * Substitui o BoundedMemorySaver (in-memory, perde estado no restart).
 *
 * REGRA CRÍTICA: as tabelas são criadas via setup() — NÃO via Drizzle schema.
 * O PostgresSaver gerencia suas próprias tabelas (checkpoints, checkpoint_blobs,
 * checkpoint_migrations, checkpoint_writes). Não adicionar ao schema.ts.
 *
 * Tabelas criadas pelo setup():
 *   - checkpoints         — estado serializado por (thread_id, checkpoint_ns, checkpoint_id)
 *   - checkpoint_blobs    — blobs de canal por versão
 *   - checkpoint_migrations — controle de versão do schema interno
 *   - checkpoint_writes   — pending writes para HITL resume
 *
 * Padrão de uso:
 *   const saver = await getPostgresSaver();
 *   // passa para buildGraph(saver) ou .compile({ checkpointer: saver })
 */

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/olympus";

// ── Singleton ─────────────────────────────────────────────────────────────────
// _initPromise garante que setup() só é chamado uma vez mesmo sob concorrência.
let _saver:       PostgresSaver | null          = null;
let _initPromise: Promise<PostgresSaver> | null = null;

/**
 * Retorna o PostgresSaver inicializado (singleton).
 * Na primeira chamada: cria o saver, executa setup() e resolve.
 * Chamadas subsequentes retornam a instância já pronta imediatamente.
 */
export async function getPostgresSaver(): Promise<PostgresSaver> {
  if (_saver) return _saver;

  if (!_initPromise) {
    _initPromise = (async () => {
      console.log("[PostgresSaver] Inicializando checkpointer...");
      const saver = PostgresSaver.fromConnString(CONNECTION_STRING);
      await saver.setup(); // cria/migra tabelas — idempotente
      _saver = saver;
      console.log("[PostgresSaver] ✅ Checkpointer pronto — estado LangGraph persistido no PostgreSQL.");
      return saver;
    })().catch((err) => {
      // Libera a promise para nova tentativa em caso de falha transitória
      _initPromise = null;
      console.error("[PostgresSaver] ❌ Falha na inicialização:", err);
      throw err;
    });
  }

  return _initPromise;
}
