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
  maxSteps?:               number;
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

Você está executando o enquadramento inicial do Método Grumbach.
O PRODUTO desta fase é a PREMISSA-ÂNCORA e o ESCOPO — não os FPFs.
FPFs serão registrados na Fase 2. NÃO use tool_register_event aqui.

MISSÃO (sequência obrigatória):
1. Ler o escopo do projeto via buscar_documentos_internos
2. Identificar: sistema analisado, horizonte temporal (anos), ponto de decisão
3. Listar 3-5 FPFs PRELIMINARES como texto narrativo (não como eventos)
4. Formular a premissa-âncora: a hipótese central que, se falsa, invalida toda a análise
5. Chamar declarar_julgamento com premissaAncora preenchida

FORMATO DO declarar_julgamento:
  premissaAncora: "[hipótese central em 1 frase assertiva]"
  julgamento: "FATO" | "INDÍCIO" | "SUPOSIÇÃO"
  justificativa: "Por que esta premissa é válida como ponto de partida"

EXEMPLO:
  premissaAncora: "A competição geopolítica por tecnologias críticas será o principal
  estruturante das relações internacionais no horizonte 2025-2045"
  julgamento: "INDÍCIO"
  justificativa: "Evidenciado por padrões de desinvestimento cruzado EUA-China..."

PROIBIDO:
- Registrar eventos com tool_register_event
- Usar "âncora" sem preencher o campo premissaAncora no declarar_julgamento
- Produzir apenas texto narrativo sem chamar declarar_julgamento
- Usar o termo "premissa-linchpin" (termo obsoleto)
`,
    allowedTools: [
      "buscar_documentos_internos",
      "declarar_julgamento",
      "web_search",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS3", "ATS5"],
    maxSteps: 8,
  },

  // ── Fase 2 — Varredura FPF ──────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p2",
    phaseNum:  2,
    nodeSlug:  "node_scanning_macro",
    label:     "Varredura de FPFs",
    systemPromptInject: `
[FASE 2 — VARREDURA DE FATOS PORTADORES DE FUTURO]

Você está catalogando os FPFs do Método Grumbach.
Meta: entre 10 e 15 FPFs. Acima de 15 = inviável para análise humana.

REGRA DE ECONOMIA DE PASSOS (crítico para eficiência):
- Para FPFs com factStatus=FATO: chamar tool_tad_score_calculator ANTES de registrar
- Para FPFs com factStatus=INDÍCIO ou SUPOSIÇÃO: calcular TAD INLINE no description
  Formato inline: "TAD estimado: B3 (confiabilidade B, credibilidade 3)"
  NÃO chamar tool_tad_score_calculator para estes — economiza 1 step por FPF

SEQUÊNCIA POR FPF:
  1. Buscar evidência (web_search ou tool_unified_search_engine)
  2. Classificar: FATO / INDÍCIO / SUPOSIÇÃO
  3a. Se FATO: chamar tool_tad_score_calculator → registrar com score alfanumérico
  3b. Se INDÍCIO/SUPOSIÇÃO: registrar diretamente com TAD inline no description

FORMATO OBRIGATÓRIO do tool_register_event para cada FPF:
  name:        "[FPF-N] [descrição em 1 frase de alto nível — questão binária]"
  type:        "fpf"
  reliability: letra A-F (confiabilidade da fonte)
  credibility: número 1-6 (credibilidade da informação)
  description: "[FPF-N] '[nome]': [qualificador Hendrikson] (P estimada ~0.XX)
               Fonte: [nome]. TAD: [score ou 'estimado B3'].
               Binário: OCORRE = [o que significa]. NÃO OCORRE = [o que significa]."

QUALIFICADORES HENDRIKSON OBRIGATÓRIOS no description:
  "quase certo" (P > 0.95) | "muito provável" (0.80-0.95) | "provável" (0.55-0.80)
  "possível" (0.45-0.55) | "improvável" (0.20-0.45) | "remoto" (P < 0.20)

REGRA DE GRANULARIDADE (evitar FPFs duplicados):
  Cada FPF = UMA questão estratégica binária de alto nível
  ERRADO: "Adoção de IA no setor público" + "Adoção de IA em defesa" (muito granular)
  CERTO: "Adoção ampla de IA em órgãos estratégicos do Estado" (1 FPF)
  Se você ultrapassar 15 FPFs, pare e consolide antes de continuar.

AO FINAL: chamar declarar_julgamento com síntese:
  "Total: N FPFs registrados. Cobertura: [áreas temáticas].
  FPF com maior incerteza: [nome]. FPF mais estruturante: [nome]."

PROIBIDO:
- Registrar sub-elementos de um FPF como FPFs separados
- FPFs sem formulação binária explícita (OCORRE / NÃO OCORRE)
- Usar tool_tad_score_calculator para INDÍCIOS e SUPOSIÇÕES
`,
    allowedTools: [
      "tool_unified_search_engine",
      "web_search",
      "buscar_dados_publicos",
      "tool_tad_score_calculator",
      "tool_register_event",
      "tool_mpc_source_evaluator",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS1", "ATS_COUNT"],
    maxSteps: 25,
  },

  // ── Fase 3 — HITL: Seleção de FPFs ─────────────────────────────────────────
  {
    phaseSlug: "grumbach_p3_hitl",
    phaseNum:  3,
    nodeSlug:  "node_scanning_forces",
    label:     "Seleção de FPFs (HITL)",
    systemPromptInject: `
[FASE 3 — AVALIAÇÃO DO CONJUNTO DE FPFs APROVADOS]

O analista acabou de selecionar os FPFs. Você recebe no anchorContext
todos os FPFs com status='approved'. Sua missão é avaliar o conjunto.

MISSÃO:
1. Verificar cobertura temática: o conjunto cobre os principais domínios
   de incerteza do sistema? Há sobreposição entre FPFs?
2. Verificar distribuição de probabilidades: o conjunto tem FPFs
   com P variada (não todos "prováveis")? Há FPFs de baixa probabilidade
   com alto impacto potencial?
3. Verificar formulação binária: todos os FPFs têm formulação booleana clara?
4. Chamar declarar_julgamento com avaliação consolidada:

FORMATO DO declarar_julgamento:
  julgamento: "FATO" | "INDÍCIO" | "SUPOSIÇÃO"
  justificativa: "Conjunto de N FPFs aprovados.
    Cobertura: [domínios cobertos].
    Gap identificado: [o que ficou de fora, se relevante].
    FPF mais estruturante: [nome + por quê].
    FPF mais incerto: [nome + P estimada].
    Conjunto APTO / REQUER ATENÇÃO para prosseguir ao Delphi."

PROIBIDO:
- Registrar novos FPFs (tool_register_event proibido)
- Alterar os FPFs aprovados pelo analista
`,
    allowedTools: [
      "tool_mpc_source_evaluator",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       true,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS_COVERAGE"],
    maxSteps: 6,
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
tool_grumbach_expert_simulation retorna INSTRUÇÕES e a lista de FPFs.
KLIO deve SIMULAR as 7 personas e GERAR as probabilidades — a ferramenta NÃO calcula.

SEQUÊNCIA OBRIGATÓRIA:
1. Chamar tool_grumbach_expert_simulation (recebe as instruções e nomes dos FPFs)
2. Para CADA FPF aprovado, simular o debate das 7 personas e calcular P(i) por consenso
3. Registrar via tool_register_event (1 evento por FPF)
4. Ao final: declarar_julgamento com síntese do Delphi

FORMATO OBRIGATÓRIO do tool_register_event:
  name:        "P(i) — [nome curto do FPF]"
  type:        "fpf"
  reliability: "B"
  credibility: "2"
  description: "[FPF-N] '[nome completo]': [QUALIFICADOR] (P=[0.XX])
               Consenso: X/7 personas.
               Posição majoritária: [síntese do argumento dominante].
               Dissidência: [argumento da minoria, se relevante]."

QUALIFICADORES OBRIGATÓRIOS (Hendrikson — usar exatamente estas palavras):
  P > 0.95  → "quase certo"
  0.80-0.95 → "muito provável"
  0.55-0.80 → "provável"
  0.45-0.55 → "possível"
  0.20-0.45 → "improvável"
  P < 0.20  → "remoto"

PROIBIDO:
- Usar percentagens sem qualificador textual (ex: "70%" sem "provável")
- Deixar de registrar algum FPF aprovado
- Fabricar consenso sem simular o debate das personas

AO FINAL: declarar_julgamento:
  "Delphi concluído. N FPFs avaliados.
   Mais provável: [FPF + P]. Mais incerto: [FPF + P].
   Distribuição: [N] prováveis/quase certos, [N] possíveis, [N] improváveis/remotos."
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS2", "ATS_DELPHI_COUNT"],
    maxSteps: 15,
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
Esta fase tem DUAS saídas obrigatórias: (1) a matriz de impactos par a par,
e (2) a classificação de cada FPF na Matriz Motricidade × Dependência.

FÓRMULA OBRIGATÓRIA — odds-ratio (NÃO é Teorema de Bayes direto):
  Chance base:     C(j) = P(j) / (1 - P(j))
  Chance ajustada: C(j|i) = C(j) × (1 + I)
  P condicional:   P(j|i) = C(j|i) / (1 + C(j|i))
  onde I = coeficiente de impacto (-3 a +3, inteiro)

EXEMPLO:
  FPF-3: P=0.30. FPF-1 ocorre com I=2 (dobra a chance).
  C(3) = 0.30/0.70 = 0.428
  C(3|1) = 0.428 × (1+2) = 1.286
  P(3|1) = 1.286 / (1+1.286) = 0.56 → "possível" → antes era "improvável"

PASSO 1 — MATRIZ DE IMPACTOS (tool_register_impact_relation):
  Para cada par (FPFi → FPFj) onde |I| >= 1:
  - Chamar tool_register_impact_relation com:
      fromEventName: "[nome exato do FPFi como registrado na Fase 2]"
      toEventName:   "[nome exato do FPFj como registrado na Fase 2]"
      impactScore:   [I inteiro de -3 a +3]
      direction:     "positive" | "negative" | "neutral"
      rationale:     "[por que FPFi afeta FPFj]"
  - Fazer isso para TODOS os pares relevantes (I != 0)
  - Use os nomes EXATOS como aparecem no anchorContext (seção FATOS PORTADORES DE FUTURO)

PASSO 2 — CLASSIFICAÇÃO MOTRICIDADE×DEPENDÊNCIA (tool_register_event):
  Para cada FPF, calcular:
    Motricidade = Σ |I(FPF → outros)|   (soma dos impactos que ele CAUSA)
    Dependência = Σ |I(outros → FPF)|   (soma dos impactos que ele RECEBE)

  Classificar em quadrante:
    Explicativo:  motricidade alta, dependência baixa → força estruturante
    Ligação:      motricidade alta, dependência alta  → amplificador instável
    Resultado:    motricidade baixa, dependência alta → consequência
    Autônomo:     motricidade baixa, dependência baixa → periférico

  Formato do tool_register_event:
    name:        "Impacto [nome curto FPF]: [quadrante]"
    type:        "fpf"
    description: "Motricidade: [score]. Dependência: [score]. Quadrante: [nome].
                 P(i) original: [provável/improvável etc.].
                 Impacto recebido mais forte: [FPFj→FPFi, I=X].
                 Impacto emitido mais forte: [FPFi→FPFk, I=X]."

PASSO 3 — ELOS FRACOS (declarar_julgamento):
  Identificar os 2-3 pares de impacto com maior incerteza.
  declarar_julgamento: "Elos mais fracos: [FPFi→FPFj, I estimado com baixa confiança].
  Motivo: [por que o impacto entre estes FPFs é incerto]."

PROIBIDO:
- Registrar impactos par a par APENAS via tool_register_event (sem tool_register_impact_relation)
- Calcular P(j|i) com Bayes direto (usar sempre odds-ratio)
- Deixar matrix_direct_impacts vazia (PASSO 1 é obrigatório)
`,
    allowedTools: [
      "tool_grumbach_expert_simulation",
      "tool_register_impact_relation",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS2", "ATS_IMPACT_MATRIX", "ATS_QUADRANTS"],
    maxSteps: 30,
  },

  // ── Fase 6 — Seleção das 4 Cenas ────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p6",
    phaseNum:  6,
    nodeSlug:  "node_matrix_design",
    label:     "Seleção dos 4 Cenários",
    systemPromptInject: `
[FASE 6 — SELEÇÃO DOS 4 CENÁRIOS GRUMBACH]

Você está selecionando os 4 cenários canônicos do Método Grumbach.
O produto desta fase é a FONTE DA VERDADE para as narrativas da Fase 7.

OS 4 CENÁRIOS OBRIGATÓRIOS:

CENÁRIO A — MAIS PROVÁVEL
  Critério: maior massa probabilística na simulação Monte Carlo (combinação de FPFs
  com maior probabilidade conjunta dado os P(i) e impactos cruzados calculados)
  Uso: cenário de referência para medidas pré-ativas

CENÁRIO B — PROJETIVO
  Critério: extrapolação das tendências históricas passadas (abordagem projetiva —
  NÃO é extraído do mapa de simulação, é um benchmark externo de continuidade)
  Uso: confronto Mais Provável × Projetivo → ruptura ou continuidade de tendência?

CENÁRIO C — IDEAL
  Critério: combinação de FPFs que maximiza os resultados para a organização
  (independente de probabilidade — é o melhor futuro possível)
  Uso: balizador normativo

CENÁRIO D — ALVO
  Critério: cenário factível entre Mais Provável e Ideal, construído via análise
  de interações estratégicas (quais FPFs podem ser influenciados pela organização?)
  Uso: cenário que a organização se propõe a construir ativamente

SEQUÊNCIA OBRIGATÓRIA para CADA cenário:

1. Chamar tool_register_scenario:
   name:        "Cenário [A/B/C/D] — [Mais Provável/Projetivo/Ideal/Alvo]"
   type:        "most_probable" | "trend" | "ideal" | "target"
   description: [configuração booleana dos FPFs]

2. Chamar tool_register_event (para ATHENA verificar):
   name: "Cenário A — Mais Provável: [FPF1=SIM, FPF2=NÃO, FPF3=SIM, ...]"
   name: "Cenário B — Projetivo: [descrição da extrapolação tendencial]"
   name: "Cenário C — Ideal: [FPF1=SIM, FPF2=SIM, FPF3=SIM, ...]"
   name: "Cenário D — Alvo: [FPF1=SIM, FPF2=NÃO, FPF3=SIM, ...]"
   type: "fpf"
   description: [probabilidade conjunta estimada + lógica de seleção]

3. Chamar declarar_julgamento com análise comparativa:
   "Cenário A × B: [ruptura ou continuidade?]
    Cenário C × A: [o que precisaria mudar para atingir o ideal?]
    Cenário D: [quais FPFs a organização pode influenciar?]"

REGRA CRÍTICA — FONTE DA VERDADE:
  A configuração booleana de CADA cenário (FPFn=SIM/NÃO) registrada aqui
  é IMUTÁVEL para a Fase 7. As narrativas NÃO PODEM contradizer estes valores.

PROIBIDO:
- Registrar apenas via tool_register_scenario sem tool_register_event
- Cenários com nomes que não incluam "Mais Provável", "Projetivo", "Ideal" ou "Alvo"
- Criar mais de 4 cenários
`,
    allowedTools: [
      "tool_register_scenario",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: false,
    atsCodes: ["ATS8", "ATS_SCENARIO_TYPES", "ATS_SCENARIO_BOOL"],
    maxSteps: 12,
  },

  // ── Fase 7 — Narrativas ─────────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p7",
    phaseNum:  7,
    nodeSlug:  "node_narrative",
    label:     "Narrativas dos 4 Cenários",
    systemPromptInject: `
[FASE 7 — NARRATIVAS DOS 4 CENÁRIOS GRUMBACH]

Você está redigindo as crônicas dos 4 cenários.
PRIMEIRO: leia o anchorContext — a seção "FATOS PORTADORES DE FUTURO" contém
os eventos registrados na Fase 6, incluindo os 4 cenários com suas configurações
booleanas (FPF1=SIM, FPF2=NÃO, etc.). USE esses nomes e configurações.

PARA CADA CENÁRIO (sequência obrigatória):

1. Identificar no anchorContext o evento "Cenário [A/B/C/D] — [tipo]: [booleanos]"
2. Redigir crônica de 300-500 palavras:
   Abertura: "Estamos em [ano]. [Situação atual no mundo deste cenário]."
   Desenvolvimento: [Como chegamos aqui — quais forças agiram]
   Estado atual: [Como a organização opera neste ambiente]
3. Chamar tool_register_event:
   name: "Narrativa Cenário [A] — [título evocativo]: [1 frase causal]"
   type: "fpf"
   description: [2-3 frases do enredo central — o que HERMES vai usar no relatório]

TÍTULOS EVOCATIVOS: o título após o "—" é criativo e livre
  Ex: "Narrativa Cenário A — Brasil Potência da Nova Ordem: A estratégia de
  reshoring atraiu investimento e redefiniu cadeias produtivas."

REGRA BOOLEANA ABSOLUTA (verificada por ATHENA):
  Para cada FPF marcado na Fase 6:
  [OCORRE] → FPF mencionado como tendo ocorrido na narrativa
  [NÃO OCORRE] → FPF ausente da narrativa ou explicitamente descartado
  Contradição = reprovação automática

PROIBIDO:
- Inventar nomes de cenários diferentes dos registrados na Fase 6
- Mencionar FPF como ocorrido se está marcado [NÃO OCORRE]
- Narrativas sem conexão causal com os FPFs
- Saltos temporais sem força motriz identificável
- Escrever "Cena" (usar sempre "Cenário")
`,
    allowedTools: [
      "buscar_documentos_internos",
      "tool_register_event",
      "declarar_julgamento",
    ],
    requiresHitlBefore:       false,
    requiresQualitativeAudit: true,
    atsCodes: ["ATS6", "ATS_BOOL_CONSISTENCY"],
    maxSteps: 20,
  },

  // ── Fase 8 — Indicações Estratégicas ────────────────────────────────────────
  {
    phaseSlug: "grumbach_p8",
    phaseNum:  8,
    nodeSlug:  "node_integration",
    label:     "Indicações Estratégicas",
    systemPromptInject: `
[FASE 8 — INDICAÇÕES ESTRATÉGICAS]

Você está conectando os cenários às recomendações estratégicas.
Esta fase produz TRÊS tipos de output com factStatus distintos:

TIPO 1 — MEDIDAS PRÉ-ATIVAS (ao menos 5)
  O que a organização deve fazer INDEPENDENTE de qual cenário se realize.
  Derivadas da análise Mais Provável × Projetivo (ruptura?) e Ideal × Mais Provável.
  factStatus: SUPOSIÇÃO (são recomendações, não fatos verificados)

  Formato tool_register_event:
    name:        "mp_[NN] — [ação clara e específica]"
    type:        "fpf"
    reliability: "C"
    credibility: "3"
    description: "Medida pré-ativa. Fundamentada no confronto [Cenário X × Cenário Y].
                 Objetivo: [o que esta ação prepara ou antecipa].
                 Responsável sugerido: [área/função]. Prazo: [curto/médio/longo]."

TIPO 2 — MEDIDAS PROATIVAS (ao menos 3)
  O que a organização deve fazer para CONSTRUIR o Cenário Alvo (D).
  Identificar quais FPFs do Cenário D a organização pode influenciar.
  factStatus: SUPOSIÇÃO

  Formato tool_register_event:
    name:        "mpro_[NN] — [ação de construção do futuro desejado]"
    type:        "fpf"
    reliability: "C"
    credibility: "3"
    description: "Medida proativa. Visa elevar P([FPF-N]) no sentido do Cenário D.
                 Parceria estratégica: [atores a engajar]. Mecanismo: [como age]."

TIPO 3 — SIGNPOSTS (ao menos 3)
  Indicadores observáveis que sinalizam qual cenário está se materializando.
  factStatus: INDÍCIO (são sinais empíricos, não certezas)

  Formato tool_register_event (OBRIGATÓRIO — ATHENA verifica este padrão):
    name: "SE [indicador específico e mensurável] > [limiar numérico]
           ENTÃO Cenário [A/B/C/D] se aproxima (+[N]% de probabilidade)"
    type: "fpf"
    reliability: "B"
    credibility: "2"
    description: "Fonte de dados: [URL ou nome da fonte].
                 Frequência de revisão: [mensal/trimestral/anual].
                 Responsável pelo monitoramento: [área]."

EXEMPLO de signpost válido:
  name: "SE IED em reshoring tecnológico > US$ 3bi/ano ENTÃO Cenário A +20%"

PROIBIDO:
- Signposts sem limiar numérico específico ("monitorar a situação" é inválido)
- Medidas sem vínculo a um cenário específico ou FPF
- Usar factStatus=FATO para medidas (são SUPOSIÇÃO) ou signposts (são INDÍCIO)
- Usar "Cena" em vez de "Cenário"
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
    atsCodes: ["ATS5", "ATS9", "ATS_MEASURES"],
    maxSteps: 20,
  },

  // ── Fase 9 — Monitoramento ──────────────────────────────────────────────────
  {
    phaseSlug: "grumbach_p9",
    phaseNum:  9,
    nodeSlug:  "node_integration",
    label:     "Painel de Monitoramento",
    systemPromptInject: `
[FASE 9 — PAINEL DE MONITORAMENTO ESTRATÉGICO]

Você está configurando o monitoramento contínuo para KRATOS.
Esta fase NÃO repete os signposts da Fase 8 — ela os OPERACIONALIZA.

DISTINÇÃO CRÍTICA:
  Fase 8: Define QUAIS indicadores monitorar (signposts como recomendação)
  Fase 9: Configura COMO monitorar (registrar_sinal alimenta KRATOS com URLs e frequências)

MISSÃO:

PASSO 1 — Recuperar sinais existentes (buscar_sinais):
  Verificar se já há sinais registrados para este projeto.

PASSO 2 — Para cada FPF aprovado, registrar_sinal:
  Chamar registrar_sinal com:
    fpfName:     [nome do FPF — exatamente como registrado na Fase 2]
    indicator:   [o que monitorar para saber se este FPF está se realizando]
    sourceUrl:   [URL da fonte primária do indicador]
    threshold:   [limiar numérico que dispara alerta]
    frequency:   "mensal" | "trimestral" | "semestral" | "anual"

  Priorizar FPFs explicativos e de ligação (quadrantes da Fase 5).

PASSO 3 — Registrar evento de consolidação (tool_register_event):
  Um evento por FPF monitorado:
    name: "SE [indicador] > [limiar] ENTÃO [FPF] se materializa"
    description: "Fonte: [URL]. Freq: [frequência]. Próx revisão: [data]."

PASSO 4 — declarar_julgamento com frequência de revisão do painel:
  "Painel configurado com N sinais. Frequência mínima: [X].
   FPFs prioritários para monitoramento: [lista dos mais estruturantes].
   Próxima revisão programada: [data sugerida]."

PROIBIDO:
- Repetir os signposts da Fase 8 sem diferenciação (Fase 9 = operacionalização)
- Chamar registrar_sinal sem sourceUrl rastreável
- Deixar FPFs estruturantes (explicativos/ligação) sem sentinela configurada
- Usar "Cena" em vez de "Cenário"
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
    atsCodes: ["ATS9", "ATS_KRATOS"],
    maxSteps: 12,
  },
];

// ── Índices para lookup rápido ────────────────────────────────────────────────
export const GRUMBACH_PHASE_MAP = new Map(
  GRUMBACH_PHASES.map(p => [p.phaseSlug, p])
);

export const GRUMBACH_PHASE_BY_NUM = new Map(
  GRUMBACH_PHASES.map(p => [p.phaseNum, p])
);
