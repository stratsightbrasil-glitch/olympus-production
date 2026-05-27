/**
 * builder.ts — Constrói e compila o StateGraph LangGraph do Olympus.
 *
 * Topologia:
 *   START
 *     └─(conditional: routeFromState)─┐
 *                                     ├─ scopus_node    → (conditional) → ...
 *                                     ├─ klio_node      → (conditional) → ...
 *                                     ├─ pythia_node    → (conditional) → ... ← interruptBefore
 *                                     ├─ mnemosyne_node → (conditional) → ...
 *                                     ├─ integration_node → (conditional) → ...
 *                                     └─ synthesis_node → END
 *
 * Checkpointer: MemorySaver (singleton de processo).
 *   - Persiste estado entre requisições SSE para o mesmo projectId (thread_id).
 *   - Suficiente para single-server. Fase 3 migrará para PostgresSaver.
 *
 * interruptBefore: ['pythia_node']
 *   - HITL nativo: grafo pausa antes de PYTHIA se não há eventos aprovados.
 *   - pythiaNode chama interrupt() internamente (verificação condicional).
 *   - Para não interromper sempre, python_node verifica eventos antes de interrupt().
 *
 * thread_id = projectId — cada projeto tem seu próprio checkpoint.
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { OlympusStateAnnotation } from "@olympus/core";
import {
  scopusNode,
  klioNode,
  pythiaNode,
  mnemosyeNode,
  integrationNode,
  synthesisNode,
} from "./nodes";
import { routeFromState } from "./router";
import { BoundedMemorySaver } from "./boundedMemorySaver";

// ── Checkpointer singleton ────────────────────────────────────────────────────
// BoundedMemorySaver: evição LRU (50 threads) + TTL (2 h) — previne OOM.
// Fase 3: substituir por PostgresSaver para persistência entre restarts de pod.
const checkpointer = new BoundedMemorySaver();

// ── Destinos válidos para arestas condicionais ────────────────────────────────
// Lista completa de todos os nós especialistas do grafo.
// Usada em TODOS os addConditionalEdges para garantir que qualquer metodologia
// pode rotear de qualquer nó para qualquer outro sem "Branch condition" errors.
const ALL_SPECIALIST_NODES = [
  "scopus_node",
  "klio_node",
  "pythia_node",
  "mnemosyne_node",
  "integration_node",
  "synthesis_node",
] as const;

// ── Singleton do grafo compilado ──────────────────────────────────────────────
let _compiled: ReturnType<typeof buildGraph> | null = null;

function buildGraph() {
  return new StateGraph(OlympusStateAnnotation)
    // ── Nós ──────────────────────────────────────────────────────────────────
    .addNode("scopus_node",      scopusNode)
    .addNode("klio_node",        klioNode)
    .addNode("pythia_node",      pythiaNode)
    .addNode("mnemosyne_node",   mnemosyeNode)
    .addNode("integration_node", integrationNode)
    .addNode("synthesis_node",   synthesisNode)
    // ── Arestas de entrada ────────────────────────────────────────────────────
    .addConditionalEdges(START, routeFromState, [
      "scopus_node",
      "klio_node",
      "pythia_node",
      "mnemosyne_node",
      "integration_node",
      "synthesis_node",
    ])
    // ── Arestas de saída dos especialistas (roteiam para o próximo nó) ────────
    //
    // IMPORTANTE: todas as arestas condicionais devem declarar TODOS os nós do
    // grafo como destinos possíveis. Restringir a lista causa
    // "Branch condition returned unknown or null destination" quando uma
    // metodologia ordena fases de forma que um nó "anterior" (ex: klio_node)
    // aparece após um nó "posterior" (ex: pythia_node).
    //
    // Exemplo concreto: GODET p2 (KLIO/MICMAC) tem nodeSlug 'node_scanning_forces'
    // e executa dentro de klio_node. Após concluir, o próximo pode ser pythia_node,
    // mnemosyne_node etc. — qualquer um dos 6 nós é válido dependendo da metodologia.
    //
    // A lista completa é declarada em ALL_SPECIALIST_NODES abaixo e reutilizada
    // em cada addConditionalEdges para evitar omissões silenciosas no futuro.
    .addConditionalEdges("scopus_node",      routeFromState, [...ALL_SPECIALIST_NODES])
    .addConditionalEdges("klio_node",        routeFromState, [...ALL_SPECIALIST_NODES])
    .addConditionalEdges("pythia_node",      routeFromState, [...ALL_SPECIALIST_NODES])
    .addConditionalEdges("mnemosyne_node",   routeFromState, [...ALL_SPECIALIST_NODES])
    .addConditionalEdges("integration_node", routeFromState, [...ALL_SPECIALIST_NODES])
    // ── Síntese → fim ─────────────────────────────────────────────────────────
    .addEdge("synthesis_node", END)
    // ── Compilação ────────────────────────────────────────────────────────────
    .compile({
      checkpointer,
      // interruptBefore garante que pythiaNode é sempre chamado (e decide internamente
      // se faz interrupt() condicional baseado em eventos aprovados).
      // Removemos o interruptBefore aqui para deixar o nó decidir via interrupt().
      // Se quiser forçar pausa incondicional antes de PYTHIA, descomentar a linha abaixo:
      // interruptBefore: ["pythia_node"],
    });
}

/**
 * Retorna o grafo compilado (singleton).
 * Lazy-initialized na primeira chamada.
 */
export function getOlympusGraph() {
  if (!_compiled) {
    _compiled = buildGraph();
  }
  return _compiled;
}

/**
 * Config LangGraph para um projeto específico.
 * thread_id = projectId garante isolamento de checkpoint por projeto.
 */
export function graphConfig(
  projectId: string,
  callbacks?: {
    onStep?:  (msg: string) => void;
    onToken?: (delta: string) => void;
  },
) {
  return {
    configurable: {
      thread_id: projectId,
      onStep:    callbacks?.onStep,
      onToken:   callbacks?.onToken,
    },
  };
}
