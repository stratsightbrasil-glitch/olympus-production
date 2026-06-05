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

PRODUTO OBRIGATÓRIO nos keyFindings:
- Ao menos 1 finding com "linchpin" no claim (premissa-linchpin declarada)
- Ao menos 3 FPFs formulados como questões binárias (variáveis de Bernoulli)
- Cada FPF registrado via tool_register_event

PROIBIDO:
- Questões abertas sem formulação booleana
- Premissas sem condição de falsificação declarada
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
[FASE 3 — CONFIGURAÇÃO DA BANCA DE ESPECIALISTAS]

O analista humano acabou de aprovar os FPFs na etapa HITL anterior.
Você está configurando as 7 personas da banca virtual de especialistas
que será usada na Fase 4 (Delphi) para atribuir probabilidades P(i).

MISSÃO:
Registrar cada uma das 7 personas via tool_register_event com:
  - name: nome curto da persona (ex: "Persona 1 — Otimista Estrutural")
  - type: "fpf" (configuração interna do painel)
  - description: viés, área de expertise e posição inicial esperada
  - reliability: "A" (configuração interna confirmada)
  - credibility: "1"

As 7 personas obrigatórias:
  1. Otimista estrutural
  2. Pessimista estratégico
  3. Tecnocrata institucional
  4. Analista geopolítico
  5. Especialista de domínio
  6. Inovador disruptivo
  7. Historiador comparativo

PRODUTO OBRIGATÓRIO:
- 7 chamadas a tool_register_event, uma por persona
- factStatus="FATO" para todas (configuração confirmada pelo analista)
`,
    allowedTools: [
      "tool_register_event",
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

MISSÃO:
- Invocar tool_grumbach_expert_simulation com os UUIDs dos FPFs aprovados
- Extrair probabilidades P(i) para cada FPF
- Usar vocabulário calibrado OBRIGATORIAMENTE:
  "quase certo" / "muito provável" / "provável" / "possível" /
  "improvável" / "remoto"
- PROIBIDO usar percentagens isoladas sem qualificador textual

PRODUTO OBRIGATÓRIO:
- Um finding por FPF com P(i) em vocabulário calibrado
- Exemplo: "FPF-3 'Adoção IA em gestão pública': Provável (P=0.65) —
  consenso 5/7 especialistas"
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_scenario",
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

PRODUTO OBRIGATÓRIO:
- Matriz de impactos registrada nos keyFindings
- Classificação Motricidade × Dependência dos FPFs
- Ao menos 1 finding declarando os elos mais fracos
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_impact_relation",
      "tool_register_scenario",
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
- 4 findings, um por cena: "Cena [A/B/C/D] — [Nome]: [configuração booleana dos FPFs]"

REGRA CRÍTICA: A configuração booleana desta fase é a FONTE DA VERDADE
para as crônicas da Fase 7. As narrativas NÃO PODEM contradizer estas configurações.
`,
    allowedTools: [
      "tool_register_scenario",
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

PRODUTO OBRIGATÓRIO nos keyFindings:
- 4 findings de narrativa, um por cena:
  "Narrativa [Cena X — nome]: [1 frase resumindo a lógica causal central]"

PROIBIDO:
- Mencionar FPF como ocorrido se marcado [NÃO OCORRE]
- Saltos temporais sem força motriz identificável
- Melhorias ou pioras inexplicáveis sem vínculo a FPF
`,
    allowedTools: [
      "buscar_documentos_internos",
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

PRODUTO OBRIGATÓRIO nos keyFindings:
- Medidas pré-ativas: ao menos 5 findings (mp_01 a mp_N)
- Medidas proativas: ao menos 3 findings (mpro_01 a mpro_N)
- Ao menos 3 signposts com limiar quantificável
- Indicações com fonte rastreável

PROIBIDO:
- Signposts sem limiar específico ("monitorar a situação" é inválido)
- Indicações sem vínculo a cena ou FPF específico
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
- Um finding por FPF com o indicador de monitoramento correspondente
- Ao menos 1 URL de fonte por indicador (para KRATOS rastrear)
- Frequência de revisão sugerida para o painel completo
`,
    allowedTools: [
      "registrar_sinal",
      "buscar_sinais",
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
