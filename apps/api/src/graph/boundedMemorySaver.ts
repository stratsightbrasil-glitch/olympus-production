/**
 * BoundedMemorySaver — MemorySaver com evição LRU + TTL.
 *
 * Problema: o MemorySaver padrão do LangGraph mantém checkpoints de TODOS os
 * threads (projectIds) em RAM indefinidamente. Em produção com dezenas de
 * projetos ativos isso causa crescimento de heap sem limite até OOM.
 *
 * Solução: subclasse que mantém no máximo MAX_THREADS threads e expira threads
 * ociosos após TTL_MS de inatividade. Usa um Map ordenado por último acesso
 * (LRU simples — Map preserva ordem de inserção em JS).
 *
 * Fase 3: substituir por PostgresSaver para persistência entre restarts de pod.
 */

import { MemorySaver } from "@langchain/langgraph";

const MAX_THREADS  = 50;           // threads simultâneos máximos em RAM
const TTL_MS       = 2 * 60 * 60 * 1000; // 2 horas de inatividade → evição

interface ThreadMeta {
  lastAccessAt: number;
}

export class BoundedMemorySaver extends MemorySaver {
  // Metadados de acesso por thread_id — map ordenado por último acesso (LRU)
  private readonly meta = new Map<string, ThreadMeta>();

  // ── Intercepts de acesso ──────────────────────────────────────────────────

  override async get(config: any): Promise<any> {
    const threadId = config?.configurable?.thread_id as string | undefined;
    if (threadId) this.touch(threadId);
    return super.get(config);
  }

  override async put(config: any, checkpoint: any, metadata: any): Promise<any> {
    const threadId = config?.configurable?.thread_id as string | undefined;
    if (threadId) {
      this.touch(threadId);
      this.evict();
    }
    return super.put(config, checkpoint, metadata);
  }

  // ── LRU bookkeeping ───────────────────────────────────────────────────────

  private touch(threadId: string) {
    // Re-insere no final do Map (LRU: último acesso = mais recente)
    this.meta.delete(threadId);
    this.meta.set(threadId, { lastAccessAt: Date.now() });
  }

  private evict() {
    const now = Date.now();

    // 1. Evict por TTL (inatividade)
    for (const [id, m] of this.meta) {
      if (now - m.lastAccessAt > TTL_MS) {
        this.dropThread(id);
      }
    }

    // 2. Evict por capacidade (LRU — o primeiro entry do Map é o mais antigo)
    while (this.meta.size > MAX_THREADS) {
      const oldest = this.meta.keys().next().value;
      if (oldest) this.dropThread(oldest);
      else break;
    }
  }

  /**
   * Remove todos os checkpoints de um thread do storage interno do MemorySaver.
   * MemorySaver armazena em `this.storage` (Map<string, Map<string, ...>>)
   * onde a chave externa é o thread_id.
   */
  private dropThread(threadId: string) {
    // Acesso ao storage interno do MemorySaver (propriedade protegida)
    const storage = (this as any).storage as Map<string, unknown> | undefined;
    if (storage) storage.delete(threadId);
    this.meta.delete(threadId);
    console.log(`[BoundedMemorySaver] 🗑 Thread "${threadId}" evicted from checkpoint cache.`);
  }

  /** Retorna estatísticas para monitoramento (exposto via /health se necessário). */
  stats() {
    return { threads: this.meta.size, maxThreads: MAX_THREADS, ttlHours: TTL_MS / 3_600_000 };
  }
}
