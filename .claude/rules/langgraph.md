---
paths:
  - "packages/core/src/**/*.ts"
  - "apps/api/src/routes/chat.ts"
  - "apps/api/src/tools/**/*.ts"
  - "packages/db/src/schema.ts"
---

# Regras de Engenharia — Motor de Agentes e Grafo de Estado

## PROIBIÇÃO ABSOLUTA DO ZOD

Nunca importar, instanciar ou usar Zod em ferramentas analíticas ou nós do grafo.
Motivo: versões ≥ 3.25.68 causam TS2589 com @langchain/core. instanceof ZodObject falha entre pacotes no monorepo.

Usar exclusivamente JSON Schema puro (Record<string, any>) em TOOL_JSON_SCHEMAS.

## ISOLAMENTO DE PACOTES

packages/tools NÃO pode importar @olympus/db.
Ferramentas com acesso ao banco ficam em apps/api/src/tools/.
Constraint de build do Dockerfile: compilação na ordem core → tools → db → api.

## PROMPTS DINÂMICOS

Agentes não têm regras de metodologia hardcoded no systemPrompt do código.
Instruções específicas por metodologia são carregadas via agentMethodPrompts do banco.
A âncora de contexto (anchorContext) é injetada no systemPrompt em runtime pelo chat.ts.

## ORQUESTRAÇÃO POR ESTADO (PREPARAÇÃO PARA LANGGRAPH)

Cada fase deve atualizar dados estruturados no banco (project_events, project_scenarios).
Não implementar loops peer-to-peer fora das arestas condicionais futuras do LangGraph.
O campo node_slug nas fases aponta para o nó LangGraph que executará essa fase.

Nós mapeados:
- node_framing        → SCOPUS — KAC, escopo, filtro Hendrikson
- node_scanning_macro → KLIO — PESTEL, megatendências, FPFs
- node_scanning_forces→ KLIO — atores, capacidades, eixos de inflexão
- node_retrospective  → KLIO — trajetória histórica, Cones de Janus, RAG
- node_modeling       → PYTHIA — MICMAC M^k, probabilidades, ACH
- node_matrix_design  → PYTHIA — Matriz 2×2, morfologia, cenário alvo
- node_narrative      → MNEMOSYNE — narrativas com travas probabilísticas
- node_integration    → THEMIS — hedges/bets, backcasting, alertas

## HUMAN-IN-THE-LOOP

project_events com status='proposed' aguardam aprovação do analista.
Pythia (node_modeling / node_matrix_design) só opera sobre eventos com status='approved'.
Essa regra será formalizada pelo interruptBefore: ['pythia_node'] do LangGraph na Fase 2.

## FERRAMENTAS MATEMÁTICAS

Agentes de IA nunca calculam coeficientes MICMAC, SMIC ou MACTOR diretamente via prompt.
Resultados matemáticos são persistidos em technique_execution_outputs e lidos pelos agentes.

## MODOS DE SOBERANIA

connectivityMode controla o acesso externo do projeto:
- ONLINE: Tavily + APIs externas liberados
- SOBERANO: RAG interno prioritário, intenção analítica não exposta externamente
- AIR_GAPPED: zero requisições SaaS, apenas documentos indexados localmente

## GESTÃO DE SESSÃO NO CLAUDE CODE

Ao finalizar qualquer tarefa complexa:
/compact "Keep LangGraph topology, StateAnnotation fields, pure JSON schema rules, node_slug mappings, HITL gates"
