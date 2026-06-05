/**
 * grumbach.ts — Configuração das 9 fases do Método Grumbach (Olympus 1.0)
 *
 * @deprecated Sprint 24 (04 Jun 2026): os dados deste arquivo foram migrados para
 * o banco via seed.ts (colunas system_prompt_inject, allowed_tools, etc. em
 * methodology_phases). O phaseLoopNode agora carrega do banco via loadPhaseConfigs().
 *
 * Este arquivo é mantido como:
 *   1. Referência documental da estrutura original
 *   2. Fonte para o seed.ts migrar para o banco (import dinâmico)
 *   3. Fallback de emergência caso o banco perca os dados
 *
 * NÃO modificar os prompts aqui — alterar diretamente no banco via seed.ts.
 * Este arquivo será removido em sprint futura após todas as metodologias migrarem.
 *
 * Fonte: METODOLOGIAS_VERIFICADAS_v4.md — Parte III (systemPromptInject verificado).
 * Motor matemático: Delphi + Impactos Cruzados (odds-ratio) + Simulação Monte Carlo.
 * 4 cenas: Mais Provável (A) · Projetivo (B) · Ideal (C) · Alvo (D)
 */

export interface PhaseConfig {
  phaseSlug:               string;
  phaseNum:                number;
  nodeSlug:                string;
  label:                   string;
  systemPromptInject:      string;
  allowedTools:            string[];
  requiresHitlBefore:      boolean;
  requiresQualitativeAudit: boolean;
  atsCodes:                string[];
}

export const GRUMBACH_PHASES: PhaseConfig[] = [
  // ── Fase 1 — Delimitação ────────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p1",
    phaseNum:  1,
    nodeSlug:  "node_framing",
    label:     "Delimitação do Sistema",
    systemPromptInject: `
[FASE 1 — DELIMITAÇÃO DO SISTEMA E ESCOPO]

Você está executando a fase de enquadramento do Método Grumbach.

REGRA ABSOLUTA — ESCOPO DESTA FASE:
Execute SOMENTE esta fase. NÃO descreva as demais fases da metodologia,
NÃO informe o número total de etapas, NÃO cite fases futuras.
O fluxo das fases é gerenciado pelo sistema — KLIO executa uma fase por vez.
Qualquer listagem de "etapas 1 a N" é proibida neste contexto.

CONTEXTO: Esta metodologia é usada para consultorias estratégicas em
empresas e órgãos civis. O produto final orienta decisões de longo prazo.

MISSÃO:
- Identificar o sistema e delimitar o escopo da análise
- Estabelecer o horizonte temporal (tipicamente 10-20 anos)
- Definir o ponto de tomada de decisão estratégica da organização
  (o nível que, se ultrapassado, altera o comportamento estratégico)
- Formular Fatos Portadores de Futuro (FPF) preliminares como
  questões binárias: ocorre / não ocorre no horizonte definido
- Isolar a premissa-linchpin do enquadramento

PRODUTO OBRIGATÓRIO:
1. Ao menos 3 FPFs via tool_register_event (questões binárias OCORRE/NÃO OCORRE).
2. OBRIGATÓRIO SEMPRE: chamar declarar_julgamento com premissaLinchpin preenchida.
   Sem esta chamada a fase FALHA na auditoria ATHENA (ATS3 — premissa-linchpin).
   Exemplo de premissaLinchpin: "A janela de oportunidade X se manifesta nos próximos Y anos."

PROIBIDO:
- Encerrar a fase sem chamar declarar_julgamento.
- Questões abertas sem formulação booleana.
- Premissas sem condição de falsificação declarada.
`,
    allowedTools: [
      "tool_tad_score_calculator",
      "tool_register_event",
      "buscar_documentos_internos",
      "declarar_julgamento",
      "web_search",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS3", "ATS5"],
  },

  // ── Fase 2 — Varredura FPF ──────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p2",
    phaseNum:  2,
    nodeSlug:  "node_scanning_macro",
    label:     "Varredura de FPFs",
    systemPromptInject: `
[FASE 2 — VARREDURA DE FATOS PORTADORES DE FUTURO]

Você está executando a pesquisa prospectiva do Método Grumbach.

MISSÃO:
- Pesquisar FPFs relevantes via tool_unified_search_engine e web_search
- Para CADA FPF identificado:
  1. Avaliar confiabilidade e veracidade da fonte
  2. Registrar via tool_register_event
  3. Aplicar segregação FATO / INDÍCIO / SUPOSIÇÃO
- Calcular score TAD via tool_tad_score_calculator para cada FATO
- Recomendação: entre 10 e 15 FPFs finais (2^10 = 1.024 cenários;
  2^15 = 32.768 cenários; acima de 15 a análise humana torna-se impraticável)

FORMATO DO CLAIM:
"[FPF-N] [descrição em uma frase] — fonte: [nome] [grau de confiabilidade]"
Exemplo: "[FPF-3] Adoção massiva de IA em gestão pública — fonte: RAND B2"

PRODUTO OBRIGATÓRIO:
- Mínimo 8 FPFs (para ter ao menos 10-15 aprovados após HITL)
- Todo finding com factStatus="FATO" DEVE ter tadScore preenchido
`,
    allowedTools: [
      "tool_unified_search_engine",
      "web_search",
      "buscar_dados_publicos",
      "tool_tad_score_calculator",
      "tool_register_event",
      "tool_mpc_source_evaluator",
      "registrar_sinal",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS1"],
  },

  // ── Fase 3 — HITL: Seleção de FPFs ─────────────────────────────────────────
  {
    phaseSlug: "grumbach_p3_hitl",
    phaseNum:  3,
    nodeSlug:  "node_scanning_forces",
    label:     "Seleção de FPFs (HITL)",
    systemPromptInject: `
[FASE 3 — CONFIRMAÇÃO PÓS-HITL: SELEÇÃO DOS FPFs]

O analista humano acabou de aprovar os FPFs na etapa HITL anterior.
Os FPFs com status='approved' na Âncora de Contexto são o conjunto final
para as próximas fases. A banca de 7 especialistas é gerada internamente
pela tool_grumbach_expert_simulation na Fase 4 — NÃO precisa ser registrada aqui.

MISSÃO:
1. Usar declarar_julgamento para registrar o julgamento sobre a qualidade e
   completude do conjunto de FPFs aprovados pelo analista.
2. Verificar se os FPFs cobrem adequadamente o espaço de incerteza do sistema.
3. Identificar a premissa-linchpin que une o enquadramento da Fase 1 ao
   conjunto de FPFs aprovados.

PROIBIDO:
- NÃO registrar personas, especialistas ou configurações de banca via tool_register_event.
- NÃO criar novos FPFs ou eventos — o conjunto foi finalizado pelo analista no HITL.
- NÃO chamar tool_register_event nesta fase.

PRODUTO OBRIGATÓRIO:
- 1 chamada a declarar_julgamento com avaliação do conjunto de FPFs aprovados,
  incluindo premissaLinchpin e grauProbabilidade calibrado (vocabulário Hendrikson).
`,
    allowedTools: [
      "tool_mpc_source_evaluator",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       true,
    requiresQualitativeAudit: false,
    atsCodes: [],
  },

  // ── Fase 4 — Delphi P(i) ────────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p4",
    phaseNum:  4,
    nodeSlug:  "node_modeling",
    label:     "Delphi — Probabilidades P(i)",
    systemPromptInject: `
[FASE 4 — DELPHI: PROBABILIDADES P(i)]

Você está executando a consulta Delphi do Método Grumbach.

IMPORTANTE — como a ferramenta funciona:
A tool_grumbach_expert_simulation NÃO retorna probabilidades prontas.
Ela retorna INSTRUÇÕES + a lista de "eventNames" (nomes dos FPFs aprovados)
+ as 7 personas configuradas. Após chamá-la, VOCÊ deve SIMULAR o painel
e GERAR os P(i) para cada FPF listado em eventNames.

MISSÃO:
1. Invocar tool_grumbach_expert_simulation (use os nomes dos FPFs como eventIds — o
   sistema resolve automaticamente para os UUIDs aprovados)
2. A ferramenta retorna "eventNames": lista dos FPFs para analisar
3. Para cada FPF em eventNames: simular as 7 personas votando conforme seus vieses
   definidos na Fase 3 e calcular consenso → P(i) [0.0–1.0]
4. Usar vocabulário calibrado OBRIGATORIAMENTE:
   "quase certo" (>0.95) / "muito provável" (0.80–0.95) / "provável" (0.55–0.80) /
   "possível" (0.45–0.55) / "improvável" (0.20–0.45) / "remoto" (<0.20)
5. Registrar cada P(i) via tool_register_event

PRODUTO OBRIGATÓRIO — um tool_register_event por FPF:
  name:        "P(i) [nome curto do FPF]"
  description: "[FPF-N] '[nome completo]': [vocabulário] (P=[0.XX]) — consenso X/7 personas"
  type:        "fpf"
  reliability: "A"
  credibility: "1"

PROIBIDO: percentagens sem qualificador textual.
PROIBIDO: pular FPFs da lista eventNames.
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS2"],
  },

  // ── Fase 5 — Impacto Cruzado ────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p5",
    phaseNum:  5,
    nodeSlug:  "node_modeling",
    label:     "Impacto Cruzado P(i|j)",
    systemPromptInject: `
[FASE 5 — IMPACTO CRUZADO: PROBABILIDADES CONDICIONAIS P(i|j)]

Você está executando a análise de Impactos Cruzados do Método Grumbach.

DIVERGÊNCIA CRÍTICA (G-1): A fórmula é via odds-ratio, NÃO Teorema de Bayes direto.

FÓRMULA OBRIGATÓRIA:
  Chance base:      C(j) = P(j) / (1 - P(j))
  Chance ajustada:  C(j|i ocorre) = C(j) × (1 + I)   onde I = coeficiente de impacto
  P(j|i ocorre) = C_ajustada / (1 + C_ajustada)
  Exemplo (livro Cap.13.2): P(A)=30%, I=2 → C=0,428 → C_aj=0,857 → P(A|B)=46%

MISSÃO:
- Segunda rodada de tool_grumbach_expert_simulation em modo Impacto Cruzado
- Para pares relevantes de FPFs, estimar coeficiente de impacto I(i,j):
  * I = 0: evento i não altera a chance de j
  * I = 1: dobra a chance de j (+100%)
  * I = 2: triplica a chance de j (+200%)
  * I negativo: reduz a chance de j
- Classificar cada FPF na Matriz Motricidade × Dependência:
  * Explicativos: alta motricidade, baixa dependência
  * Ligação: alta motricidade, alta dependência (amplificadores de instabilidade)
  * Resultado: baixa motricidade, alta dependência
  * Autônomos: baixa motricidade, baixa dependência
- Documentar elos mais fracos da cadeia de raciocínio

PRODUTO OBRIGATÓRIO — AMBAS as chamadas são exigidas:
1. tool_register_event para cada FPF classificado (OBRIGATÓRIO — sem isso ATHENA reprovará):
   - name: "Impacto [nome curto FPF]: [quadrante Motricidade×Dependência]"
   - description: "motricidade [X]% dependência [Y]% — [vocabulário Hendrikson] (ex: provável impacto)"
   - type: "fpf" | reliability: "A" | credibility: "1"
2. declarar_julgamento para os elos mais fracos com premissaLinchpin e grauProbabilidade calibrado.

PROIBIDO: encerrar a fase sem ao menos 1 chamada a tool_register_event.
PROIBIDO: omitir vocabulário Hendrikson nas descriptions dos eventos.
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_impact_relation",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS8"],
  },

  // ── Fase 6 — Seleção das 4 Cenas ────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p6",
    phaseNum:  6,
    nodeSlug:  "node_matrix_design",
    label:     "Seleção das 4 Cenas",
    systemPromptInject: `
[FASE 6 — SELEÇÃO DAS 4 CENAS — MÉTODO GRUMBACH]

Você está selecionando as cenas finais do Método Grumbach.

MISSÃO:
- Processar o histograma combinatório das probabilidades calculadas
- Selecionar as 4 cenas canônicas do Método Grumbach:

  CENA A — MAIS PROVÁVEL
  Critério: maior massa probabilística no mapa de simulação Monte Carlo
  Papel: cenário de referência para análise pré-ativa

  CENA B — PROJETIVO
  Critério: extrapolação das tendências históricas passadas (abordagem projetiva)
  Não é extraída do mapa de simulação — é um benchmark externo de continuidade
  Papel: permite o confronto Mais Provável × Projetivo para revelar
  se há ruptura ou manutenção de tendência

  CENA C — IDEAL
  Critério: combinação de FPFs que maximiza os resultados para a organização
  (independente de sua probabilidade)
  Papel: balizador normativo; indica o melhor futuro possível

  CENA D — ALVO
  Critério: cenário factível situado entre Mais Provável e Ideal;
  construído via análise de interações estratégicas e identificação de parcerias
  Papel: o futuro que a organização se propõe a construir ativamente

- Registrar cada cena via tool_register_scenario
- Para Cenas A, C, D: listar FPFs com [OCORRE] ou [NÃO OCORRE]
- Para Cena B: descrever configuração tendencial (extrapolação histórica)

ANÁLISE COMPARATIVA obrigatória (registrar nos keyFindings):
- Mais Provável × Projetivo → ruptura ou continuidade de tendência?
- Ideal × Mais Provável → futuro é oportunidade ou ameaça?

PRODUTO OBRIGATÓRIO:
1. Registrar cada cena via tool_register_scenario (para o banco de cenários).
2. Registrar cada cena também via tool_register_event para ATHENA verificar:
   - name: "Cena A — Mais Provável: [FPF1=SIM, FPF2=NÃO, ...]"
   - name: "Cena B — Projetivo: [descrição tendencial]"
   - name: "Cena C — Ideal: [FPF1=SIM, FPF2=NÃO, ...]"
   - name: "Cena D — Alvo: [FPF1=SIM, FPF2=NÃO, ...]"
   - type: "fpf" | reliability: "A" | credibility: "1"
3. Análise comparativa via declarar_julgamento.

REGRA CRÍTICA: A configuração booleana desta fase é a FONTE DA VERDADE
para as crônicas da Fase 7. As narrativas NÃO PODEM contradizer estas configurações.
`,
    allowedTools: [
      "tool_register_scenario",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS8"],
  },

  // ── Fase 7 — Narrativas ─────────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p7",
    phaseNum:  7,
    nodeSlug:  "node_narrative",
    label:     "Narrativas das 4 Cenas",
    systemPromptInject: `
[FASE 7 — NARRATIVAS DAS 4 CENAS]

Você está escrevendo as crônicas do Método Grumbach.

MISSÃO:
- Para cada uma das 4 cenas: redigir crônica em primeira pessoa do futuro
  Estrutura: "Estamos em [ano]..." (300-500 palavras)
  Início (condições que levaram a este futuro) →
  Desenvolvimento (reorganização em curso) →
  Estado atual (como a organização opera neste ambiente)

- REGRA BOOLEANA ABSOLUTA: cada FPF deve se comportar na narrativa
  EXATAMENTE conforme declarado na configuração booleana da Fase 6:
  [OCORRE] = evento mencionado como tendo ocorrido
  [NÃO OCORRE] = evento ausente ou explicitamente descartado

PRODUTO OBRIGATÓRIO nos keyFindings — registre via tool_register_event:
- 4 findings, um por cena:
  - name: "Narrativa Cena A — [nome]: [1 frase resumindo a lógica causal central]"
  - name: "Narrativa Cena B — [nome]: [1 frase resumindo a lógica causal central]"
  - name: "Narrativa Cena C — [nome]: [1 frase resumindo a lógica causal central]"
  - name: "Narrativa Cena D — [nome]: [1 frase resumindo a lógica causal central]"
  - type: "fpf" | reliability: "A" | credibility: "1"
  - description: parágrafo de 2-3 frases com o enredo central da crônica

PROIBIDO:
- Mencionar FPF como ocorrido se marcado [NÃO OCORRE]
- Saltos temporais sem força motriz identificável
- Melhorias ou pioras inexplicáveis sem vínculo a FPF
`,
    allowedTools: [
      "buscar_documentos_internos",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS6"],
  },

  // ── Fase 8 — Indicações Estratégicas ────────────────────────────────────────
  {
    phaseSlug: "grumbach_p8",
    phaseNum:  8,
    nodeSlug:  "node_integration",
    label:     "Indicações Estratégicas",
    systemPromptInject: `
[FASE 8 — INDICAÇÕES ESTRATÉGICAS E ANÁLISE PRÉ-ATIVA]

Você está conectando os cenários às recomendações estratégicas.

MISSÃO:
- Análise pré-ativa (preparação): comparar Cenas para identificar
  o que a organização deve fazer independente do cenário que se realize
  * Ideal × Mais Provável → oportunidades ou ameaças a antecipar?
  * Mais Provável × Projetivo → ruptura de tendência exige adaptação?
  Resultado: MEDIDAS PRÉ-ATIVAS (ações de preparação)

- Análise proativa (construção): para o Cenário Alvo (Cena D),
  identificar linhas de ação e parcerias estratégicas para elevar
  a probabilidade dos FPFs desejados
  Resultado: MEDIDAS PROATIVAS (ações de construção do futuro desejado)

- Para cada FPF relevante do Cenário Alvo:
  Tabela: FPF × Oportunidades × Ameaças × Indicação estratégica

- Signposts of Change com limiares EMPIRICAMENTE OBSERVÁVEIS:
  Formato: "SE [condição específica] > [limiar] ENTÃO [cenário se aproxima]"
  Exemplo: "SE gastos em P&D / PIB > 2,5% ENTÃO Cena C +20%"

PRODUTO OBRIGATÓRIO — USE tool_register_event para CADA item abaixo:
1. Medidas pré-ativas (ao menos 5): name "mp_01 — [ação]", description com análise comparativa
2. Medidas proativas (ao menos 3): name "mpro_01 — [ação]", description com FPF alvo
3. Signposts (ao menos 3) — USE tool_register_event com o padrão EXATO no nome:
   - name: "SE [indicador] > [limiar] ENTÃO Cena [X] +[N]%"
   - description: URL rastreável + frequência de revisão
   - type: "fpf" | reliability: "A" | credibility: "1"

PROIBIDO:
- Signposts apenas no texto narrativo sem chamada a tool_register_event.
- Signposts sem limiar específico e quantificável.
- Indicações sem vínculo a cena ou FPF específico.
`,
    allowedTools: [
      "registrar_sinal",
      "tool_register_event",
      "buscar_documentos_internos",
      "declarar_julgamento",
      "web_search",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS5", "ATS9"],
  },

  // ── Fase 9 — Monitoramento ──────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p9",
    phaseNum:  9,
    nodeSlug:  "node_integration",
    label:     "Painel de Monitoramento",
    systemPromptInject: `
[FASE 9 — PAINEL DE MONITORAMENTO ESTRATÉGICO]

Você está produzindo o painel de monitoramento para KRATOS.

MISSÃO:
- Para cada FPF aprovado: definir indicador de monitoramento
- Para cada indicador: fonte primária, limiar de alerta, frequência sugerida
- Configurar payload para KRATOS (lista de signposts com URLs rastreáveis)

PRODUTO OBRIGATÓRIO:
1. registrar_sinal para cada indicador de monitoramento.
2. Registrar via tool_register_event os signposts principais:
   - name: "SE [indicador] > [limiar] ENTÃO Cena [X] +[N]%"
   Exemplos:
   - "SE IED manufatura média tecnologia > US$ 5bi/ano ENTÃO Cena A +15%"
   - "SE licença ambiental mineração Amazônia > 5 anos ENTÃO Cena A -20%"
   - type: "fpf" | reliability: "A" | credibility: "1"
   - description: URL rastreável + frequência de revisão sugerida
3. Frequência de revisão sugerida para o painel completo via declarar_julgamento.

PRODUTO MÍNIMO: ao menos 3 signposts registrados via tool_register_event.
`,
    allowedTools: [
      "registrar_sinal",
      "buscar_sinais",
      "tool_register_event",
      "declarar_julgamento",
      "web_search",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS9"],
  },
];

// ── Índices para lookup rápido ────────────────────────────────────────────────
export const GRUMBACH_PHASE_MAP = new Map(
  GRUMBACH_PHASES.map(p => [p.phaseSlug, p])
);

export const GRUMBACH_PHASE_BY_NUM = new Map(
  GRUMBACH_PHASES.map(p => [p.phaseNum, p])
);
