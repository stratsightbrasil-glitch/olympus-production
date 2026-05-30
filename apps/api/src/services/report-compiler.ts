/**
 * report-compiler.ts — Strategic Slate Compiler (Backlog item 9)
 *
 * Gera instruções de estrutura de relatório final para cada metodologia.
 * Injetado no finalInputMsg pelo orquestrador (chat.ts) antes do relatório final.
 *
 * Dois modos:
 *  - "standard": seções com conclusões e entregáveis de fase
 *  - "extended": idem + subseção de Raciocínio Analítico e Lastro Cognitivo por seção
 *
 * REGRA CRÍTICA: nunca importar @olympus/db aqui.
 * Este serviço é puro TypeScript — sem dependências de banco.
 */

export type MethodologySlug =
  | "msef"
  | "godet"
  | "gbn"
  | "esg"
  | "otan"
  | "ipea"
  | "grumbach"
  | "mpo"
  | "eb70_mt_10401"
  | "siex"
  | "siplex";

export type ReportLayout = "standard" | "extended";

// ── Mapeamento de slugs de banco para slugs do compilador ─────────────────────
// O banco usa nomes completos; normalizamos para slugs canônicos.
const SLUG_MAP: Record<string, MethodologySlug> = {
  "msef v3 (8 etapas enap)":                        "msef",
  "godet: escola estrutural":                        "godet",
  "gbn (global business network - peter schwartz)":  "gbn",
  "esg: cenários prospectivos":                      "esg",
  "otan/alta":                                       "otan",
  "ipea/fgv: cenários estreitados de desenvolvimento": "ipea",
  "grumbach: produção de cenários":                  "grumbach",
  "mpo: estratégia brasil 2050":                     "mpo",
  "mpc: conhecimento estimativa eb":                 "eb70_mt_10401",
  "siplex/ceeex: cenários da força terrestre":       "siplex",
  "siex":                                            "siex",
};

export function normalizeMethodologySlug(raw: string): MethodologySlug | null {
  const key = raw.toLowerCase().trim();
  return SLUG_MAP[key] ?? null;
}

// ── Seções por metodologia ─────────────────────────────────────────────────────
const METHODOLOGY_SECTIONS: Record<MethodologySlug, { title: string; content: string }[]> = {

  msef: [
    {
      title: "1. Enquadramento Estratégico (SCOPUS)",
      content: "Definição clara do problema central, escopo, horizonte temporal (5-10-20 anos) e stakeholder principal. Premissas-linchpin declaradas e avaliadas. Key Intelligence Questions (KIQs) para o tomador de decisão.",
    },
    {
      title: "2. Varredura Macroambiental (KLIO — PESTEL)",
      content: "Análise PESTEL com todos os domínios. Megatendências e tendências de peso. Classificação TAD inline por afirmação (alfanumérico para SIEx/OTAN; semântico para MSEF). Delineamento CONTINUIDADE/ALTERAÇÃO de julgamento.",
    },
    {
      title: "3. Forças Motrizes e FPF (KLIO)",
      content: "Atores estratégicos, capacidades e vulnerabilidades. Fatos Portadores de Futuro (FPF) registrados. Trajetória histórica como fundação da Estimativa.",
    },
    {
      title: "4. Modelagem de Incertezas e Matriz 2×2 (PYTHIA)",
      content: "Incertezas críticas priorizadas. Dois eixos ortogonais com polos (+) e (−). Matriz 2×2 com 4 quadrantes (Q1-Q4). Probabilidades em linguagem Hendrikson/ICD 203 — quase certo, muito provável, provável, possível, improvável, remoto.",
    },
    {
      title: "5. Narrativas de Cenários (MNEMOSYNE)",
      content: "Uma narrativa por quadrante (Q1-Q4) com estrutura obrigatória: INÍCIO (situação de partida) → DESENVOLVIMENTO (encadeamento causal) → FIM (estado estável no horizonte). 'É [ano]. O mundo que emergiu foi...' Mínimo 400 palavras por cenário.",
    },
    {
      title: "6. Implicações Estratégicas e Alertas (THEMIS)",
      content: "Hedges (ações robustas em todos os cenários) e Bets (apostas no cenário mais provável) com prazo + ação específica. Tabela de alertas precoces: signpost observável → cenário ativado. Mínimo 2 signposts de CONFIRMAÇÃO e 2 de REFUTAÇÃO por cenário.",
    },
  ],

  godet: [
    {
      title: "1. Introdução e Delimitação do Escopo",
      content: "Definição do problema central ou sistema-objeto. Fixação da janela de prospecção (curto=5a, médio=10a, longo=20a).",
    },
    {
      title: "2. Fase Diagnóstica: O Campo de Jogo e o Sistema (MICMAC e MACTOR)",
      content: "Matriz MICMAC: variáveis-chave classificadas por influência e dependência (Motrizes / Ligação / Dependentes / Independentes). Análise MACTOR: stakeholders com poder de influência, graus de aliança e conflitos de interesse.",
    },
    {
      title: "3. Dinâmica do Sistema: Tendências e Rupturas",
      content: "Fatores Predeterminados (macro-tendências independentes), Fatos Portadores de Futuro (sinais fracos indutores de ruptura) e Invariantes (elementos estruturais imutáveis).",
    },
    {
      title: "4. Construção dos Cenários Prospectivos (Método MORPHOL)",
      content: "Espaço morfológico com hipóteses alternativas (2-4) por variável-chave. Cenário de Referência (tendencial), Cenários Alternativos (contraste) e Cenário Desejável (estratégico/visionário). Probabilidades em linguagem calibrada ICD 203.",
    },
    {
      title: "5. Implicações e Recomendações Estratégicas",
      content: "Planos de ação imediatos. Planos de contingência para o cenário pessimista. Rotas de oportunidade para o cenário otimista.",
    },
  ],

  gbn: [
    {
      title: "1. Questão Focal e Escopo (A Decisão Central)",
      content: "Definição exata da Decisão Central ou pergunta estratégica. Horizonte temporal e unidade de análise.",
    },
    {
      title: "2. Forças Motrizes (Driving Forces — STEEP)",
      content: "Mapeamento dos fatores externos categorizados por STEEP (Sociais, Tecnológicos, Econômicos, Ambientais/Ecológicos, Políticos).",
    },
    {
      title: "3. Incertezas Críticas vs. Tendências Predeterminadas",
      content: "Divisão entre Fatos Predeterminados (previsíveis/inevitáveis) e Incertezas Críticas (alto impacto e imprevisibilidade). Seleção das 2 maiores incertezas críticas como eixos.",
    },
    {
      title: "4. A Matriz de Cenários (Eixos de Incerteza 2×2)",
      content: "Cruzamento das duas maiores incertezas críticas em quadrante ortogonal 2×2. Quatro cenários distintos e nomeados.",
    },
    {
      title: "5. Narrativas dos Cenários (As Histórias)",
      content: "Nome marcante/memorável por cenário. Lógica causal de como o mundo chegou ali. Contexto operacional vivido no horizonte. Consistência com as forças motrizes.",
    },
    {
      title: "6. Implicações Estratégicas e Indicadores Precoces",
      content: "Opções Robustas (funcionam em todos os cenários). Lista estrita de 3 a 5 Sinais de Alerta de curto prazo para rastreamento.",
    },
  ],

  esg: [
    {
      title: "1. Delimitação do Sistema e Horizonte de Análise",
      content: "Objeto focado em soberania, segurança, defesa ou desenvolvimento nacional. Horizonte de longo prazo (15-20 anos).",
    },
    {
      title: "2. Análise da Conjuntura Estratégica",
      content: "Mapeamento multinível: Ambiente Global, Regional e Nacional. Diagnóstico integrado por Expressões do Poder Nacional (Político, Econômico, Psicossocial, Militar, C&T, Ambiental).",
    },
    {
      title: "3. Identificação das Sementes de Futuro",
      content: "Megatendências Globais, Tendências de Peso, Fatos Portadores de Futuro (FPF), Fatos Predeterminados, Sinais Fracos, Wild Cards e Mapeamento de Atores Sociais.",
    },
    {
      title: "4. Análise Estrutural do Sistema (MICMAC + MACTOR)",
      content: "Matriz de Impactos Cruzados com classificação de variáveis (Motrizes / Ligação / Dependentes / Autônomas). Estratégia dos atores com convergências e divergências.",
    },
    {
      title: "5. Ranking das Incertezas Integrado (RII)",
      content: "Hierarquização via fórmula: II = I × (6−G) × (6−C). Identificação das 2 Incertezas Críticas (IC1 e IC2). Definição dos polos (+) e (−) de cada IC.",
    },
    {
      title: "6. Construção da Matriz de Cenários e Narrativas",
      content: "Quatro quadrantes: Favorável (IC1+/IC2+), Híbrido Favorável (IC1+/IC2−), Desfavorável (IC1−/IC2−), Híbrido Desfavorável (IC1−/IC2+). Eleição do Cenário Mais Plausível com justificativa.",
    },
    {
      title: "7. Teste de Consistência e Alinhamento Normativo (Backcasting)",
      content: "Eliminação de contradições lógicas. Articulação do Cenário Ideal/Desejado orientando ações do presente.",
    },
    {
      title: "8. Indicadores e Monitoramento Estratégico",
      content: "Painel com Sinais Fracos e indicadores quantitativos/qualitativos para revisão contínua de hipóteses.",
    },
  ],

  otan: [
    {
      title: "1. Iniciação e Definição da Pergunta Central (Focus Issue)",
      content: "Pergunta Orientadora/Focal clara. Identificação de Stakeholders e proprietários do problema.",
    },
    {
      title: "2. Técnicas de Estruturação e Mapeamento (Structuring)",
      content: "Mapeamento Mental (checklists), Mapeamento Conceitual (hubs de interdependências com setas conectoras) e Imagens Ricas (Rich Pictures com símbolos e perspectivas subjetivas).",
    },
    {
      title: "3. Técnicas Criativas e Geração de Hipóteses (Creative)",
      content: "Brainstorming Estruturado com Fase Divergente (expansão) e Fase Convergente (filtragem/votação). Futuros potenciais gerados.",
    },
    {
      title: "4. Análise de Futuros Alternativos e Diagnóstico (Diagnostic)",
      content: "Key Assumptions Check (validação de premissas ocultas). Análise de Futuros Alternativos. Simulação de mentalidade de terceiros via Adversário Substituto (Role Play).",
    },
    {
      title: "5. Técnicas de Desafio e Robustez Estratégica (Challenge)",
      content: "Análise What-If (choques súbitos), Análise Pré-Morte (Pre-Mortem assumindo fracasso para capturar falhas atuais) e Advocacia do Diabo.",
    },
  ],

  ipea: [
    {
      title: "1. Marco Teórico e Delimitação do Sistema-Objeto",
      content: "Princípios conceituais que interpretam o objeto. Abordagem sistêmica (variáveis centrais e nexo causal). Horizonte temporal de médio a longo prazo.",
    },
    {
      title: "2. Diagnóstico Sistêmico e Identificação de Latências",
      content: "Comportamento integrado das partes (Variáveis Determinantes). Mapeamento de condicionantes. Análise qualitativa profunda isolando instabilidades de curto prazo.",
    },
    {
      title: "3. Triagem e Classificação dos Condicionantes",
      content: "Elementos Constantes (Invariantes), Mudanças Predeterminadas e Incertezas Críticas separadas por grau de incerteza.",
    },
    {
      title: "4. Formulação de Hipóteses e Análise de Consistência",
      content: "Caminhos logicamente demonstráveis para cada incerteza. Teste de Consistência Teórica eliminando combinações incompatíveis.",
    },
    {
      title: "5. Narrativas e Trajetórias dos Cenários Alternativos",
      content: "Cenário de Referência (trajetória mais provável) e Cenários Alternativos (bifurcações) com caminho cronológico via Cone de Possibilidades.",
    },
    {
      title: "6. Construção do Cenário Normativo ou Desejado",
      content: "Aspirações coletadas (Consulta Organizacional). Utopia Plausível confrontada com inércias materiais. Calibragem de viabilidade.",
    },
    {
      title: "7. Implicações Estratégicas e Aprendizagem Organizacional",
      content: "Análise de Atores Sociais (quadro hegemônico e alianças). Diretrizes para ação (programas rumo ao Cenário Desejado). Estratégias de Contingência.",
    },
    {
      title: "8. Painel de Monitoramento Estratégico",
      content: "Indicadores de Trajetória e Rastreamento de Sinais para revisão contínua de hipóteses.",
    },
  ],

  grumbach: [
    {
      title: "1. Identificação do Sistema e Fronteiras Organizacionais",
      content: "Histórico/negócio da instituição. Missão/Visão/Valores. Estrutura Funcional: Árvore de Processos e Árvore de Recursos.",
    },
    {
      title: "2. Diagnóstico Estratégico Participativo (Causa → Consequência → Medida)",
      content: "Modelo científico Causa→Consequência→Medida via PESTEL e Estratégia de Atores. Medidas Reativas validadas.",
    },
    {
      title: "3. Definição das Questões Estratégicas (KIQs)",
      content: "Dúvidas ambientais transformadas em variáveis discretas binárias de Bernoulli, aprovadas pelo decisor.",
    },
    {
      title: "4. Processamento da Pesquisa Delphi e Impactos Cruzados",
      content: "Consulta independente a peritos e stakeholders sobre probabilidade/pertinência. Matriz de Impactos Cruzados (motricidade e dependência matemática).",
    },
    {
      title: "5. Geração do Mapa de Cenários por Simulação (Monte Carlo)",
      content: "Partição exata do espaço amostral (2^n combinações). Quadro de Futuros Alternativos com distribuição de probabilidades.",
    },
    {
      title: "6. Análise de Cenários e Posicionamento Estratégico",
      content: "Quatro cenários: Mais Provável (Referência), Projetivo (extrapolação linear), Ideal (combinação ótima) e Alvo (normativo factível via Teoria dos Jogos).",
    },
    {
      title: "7. Avaliação Prospectiva e Linhas de Ação",
      content: "Medidas Pré-Ativas (confronto Ideal vs Provável e Provável vs Projetivo). Análise Proativa via Dilemas Sociais: Juízes, Jogadores, Plateia, Apostadores.",
    },
    {
      title: "8. Tradução e Execução da Estratégia (Alinhamento BSC e Riscos)",
      content: "Critérios de Adequabilidade, Exequibilidade e Aceitabilidade. Objetivos Estratégicos nas perspectivas BSC: Resultados, Processos e Recursos. Metas e faixas de controle de riscos.",
    },
  ],

  mpo: [
    {
      title: "1. Definição do Objeto do Cenário e seu Horizonte (Etapa 1)",
      content: "Pergunta Mobilizadora de intencionalidade de longo prazo (janela de 25 anos).",
    },
    {
      title: "2. Análise Retrospectiva e Situação Atual (Etapa 2)",
      content: "Ancoragem multidimensional em dados conjunturais. Catalogação de Ativos e Passivos Estruturais do sistema.",
    },
    {
      title: "3. Mapeamento de Megatendências e Incertezas (Etapa 3)",
      content: "Movimentos estruturais globais (magnitude/direção visível). Novas forças de incerteza mundiais/nacionais.",
    },
    {
      title: "4. Priorização e Seleção de Megatendências (Etapa 4)",
      content: "Matriz de impactos cruzados. Tipificação estrutural MICMAC: Variáveis Motrizes, Ligação, Resultado e Autônomas.",
    },
    {
      title: "5. Priorização e Seleção de Incertezas Críticas (Etapa 5)",
      content: "Filtragem via MICMAC indireto. Eixos de Inflexão na zona de alta motricidade/dependência.",
    },
    {
      title: "6. Geração dos Cenários — Método MORPHOL (Etapa 6)",
      content: "Matriz combinatória morfológica cruzando hipóteses. Filtro de Factibilidade retendo apenas lógicas plausíveis.",
    },
    {
      title: "7. Configuração dos Arquétipos dos Cenários (Etapa 7)",
      content: "Três trajetórias: Cenário Desejado (desenvolvimento/inclusão), Cenário Intermediário (avanços moderados) e Cenário de Crescimento Lento (futuro adiado/estagnação).",
    },
    {
      title: "8. Desenvolvimento Qualitativo das Narrativas e Matriz de Riscos (Etapa 8)",
      content: "Textos qualitativos detalhados por dimensão. Matriz de Riscos e Oportunidades de cada rota.",
    },
    {
      title: "9. Quantificação dos Cenários (Etapa 9)",
      content: "Modelagem macroeconômica complementar. Projeções numéricas e estimativas de resultados fiscais/estruturais.",
    },
  ],

  eb70_mt_10401: [
    {
      title: "ESTIMATIVA DE INTELIGÊNCIA Nº ___/___",
      content: "Cabeçalho obrigatório. Identificação do escalão, assunto, data e classificação de sigilo.",
    },
    {
      title: "1. DADOS CONHECIDOS",
      content: "Antecedentes Imediatos (registro cronológico de fatos validados pela TAD). Situação Atual do Assunto (quadro fático isento, dispositivo e indícios de ameaças). Todos os dados com avaliação TAD alfanumérica (ex: ComDCiber B2).",
    },
    {
      title: "2. FATORES DE INFLUÊNCIA",
      content: "2.1 Análise Individual: Frequência (constância), Intensidade (magnitude) e Efeitos (consequências) de cada fator. 2.2 Análise Fator × Fator: forma de atuação coletiva (antagônica/concorrente/complementar), comparação de intensidades e efeitos mútuos. 2.3 Delineamento da Trajetória Atual: encadeamento causal do passado ao presente. 2.4 Fatores que Atuarão no Futuro: Persistência (estáveis), Inferidos (deduzidos por comportamento passado), Impostos (condicionantes externos) e Situações Pendentes (lacunas).",
    },
    {
      title: "3. HIPÓTESES",
      content: "Formulação de caminhos lógicos de evolução e cursos de ação alternativos. Hipótese A (Mais Provável), Hipótese B (Alternativa), etc. Cada hipótese fundamentada nos Fatores de Influência.",
    },
    {
      title: "4. CONCLUSÃO",
      content: "4.1 Cenário Estimado/Hipótese Mais Provável: eleição fundamentada com maior probabilidade analítica. 4.2 Fundamentação e Reflexos: demonstração lógica do comportamento futuro dos fatores e Prováveis Reflexos para o Escalão Considerado (implicações táticas, riscos e tomada de decisão do Comandante).",
    },
  ],

  siex: [
    {
      title: "1. PLANEJAMENTO — Ficha de Planejamento",
      content: "Assunto, Faixa de Tempo, Usuário/Destinatário, Finalidade, Prazo de Conclusão. Assunto de Especial Conhecimento (AEC) e Assuntos de Especial Conhecimento Conhecidos (AECK). Medidas de Segurança aplicáveis.",
    },
    {
      title: "2. REUNIÃO — Coleta por AECK com Avaliação TAD",
      content: "Busca e coleta por cada AECK. Avaliação TAD alfanumérica obrigatória: Idoneidade da Fonte (A-E) e Credibilidade do Dado (1-6) expressos em código (ex: B2). Fontes classificadas conforme capacidade de acesso e histórico.",
    },
    {
      title: "3. ANÁLISE E SÍNTESE",
      content: "Pertinência dos dados ao assunto. Credibilidade das informações. Frações significativas selecionadas. Integração das informações em corpo analítico coerente.",
    },
    {
      title: "4. INTERPRETAÇÃO — Fatores de Influência e Hipóteses",
      content: "Fatores de influência identificados com trajetória (passado→presente). Hipóteses hierarquizadas por probabilidade. Linguagem TAD alfanumérica em todas as afirmações.",
    },
    {
      title: "5. FORMALIZAÇÃO E DIFUSÃO — Estimativa de Inteligência",
      content: "Implicações por hipótese. Indicadores de alerta precoce. Recomendações ao escalão superior. Produto final: Estimativa de Inteligência conforme §5.8 do EB70-MT-10.401.",
    },
  ],

  siplex: [
    {
      title: "1. Introdução, Escopo e Alinhamento Político-Estratégico",
      content: "Vinculação explícita do objeto de estudo com os documentos de nível político e estratégico nacionais: PND (Política Nacional de Defesa), END (Estratégia Nacional de Defesa), PMiD (Política Militar de Defesa), EMiD (Estratégia Militar de Defesa), Cenário de Defesa e Cenário Militar de Defesa. Fixação obrigatória do horizonte temporal integrado — máximo de 20 anos (teto estipulado pelo Ministério da Defesa).",
    },
    {
      title: "2. Diagnóstico e Ingestão de Fontes Selecionadas (Credibilidade, Isonomia e Autenticidade)",
      content: "Catalogação exaustiva e cruzada de dados oriundos de organismos internacionais, nações amigas, órgãos de pesquisa governamentais e acadêmicos. Aplicação paramétrica da Técnica de Avaliação de Dados (TAD): idoneidade da fonte (A-F) e credibilidade do conteúdo (1-6), expressos em código alfanumérico conforme padrão SIEx/OTAN.",
    },
    {
      title: "3. Triagem de Fatores e Dinâmica de Consenso (Tendências, Incertezas Críticas e FPF)",
      content: "Consolidação de fatores de influência analisados individualmente (preservando a originalidade analítica). Agrupamento em tendências, incertezas críticas, eventos e Fatos Portadores de Futuro (FPF) priorizados por dinâmica de consenso (Delphi, Painel de Especialistas ou Impactos Cruzados).",
    },
    {
      title: "4. Matriz de Entregáveis Estratégicos de Médio e Longo Prazos",
      content: "EXATAMENTE 20 Oportunidades estratégicas de médio e longo prazos para a Força Terrestre — numeradas e nomeadas individualmente. EXATAMENTE 20 Ameaças estratégicas de médio e longo prazos para a Força Terrestre — numeradas e nomeadas individualmente. EXATAMENTE 10 Temas de Interesse transversais aptos a serem convertidos em Temas de Acompanhamento contínuo pelo CEEEx — numerados e nomeados. PROIBIDO: arredondamentos, agrupamentos genéricos ou fusão de itens para atingir a cota numérica.",
    },
    {
      title: "5. Descrição dos Cenários",
      content: "5.1 CENÁRIOS SINTÉTICOS: Matriz combinatória em formato de tabela Markdown com os 10 eventos binários (derivados dos 10 Temas de Interesse), com coluna [OCORRE] / [NÃO OCORRE] para cada um dos 4 cenários normativos: Cenário de Tendência | Cenário Mais Provável | Cenário Mais Desfavorável | Cenário Alvo (futuro mais favorável alcançável pelo exercício pleno da liberdade de ação institucional). A tabela deve ter 10 linhas × 4 colunas de cenário + 1 coluna de evento. \n5.2 DESCRIÇÃO DOS CENÁRIOS: Narrativa qualitativa densa para cada um dos 4 cenários ('Histórias do Futuro'), evidenciando o nexo causal das trajetórias cronológicas decorrentes do comportamento combinado dos 10 eventos binários. Isomorfismo obrigatório com a tabela da seção 5.1.",
    },
    {
      title: "6. Indicações Estratégicas e Panorama de Desdobramento (Folhas Anexas)",
      content: "Linhas de Esforço coordenadas para a formulação da Política Militar Terrestre e visão de futuro da Instituição. Para cada Indicação Estratégica, uma Folha Anexa com os 6 campos obrigatórios: (1) Nome da Indicação Estratégica; (2) Vínculo Doutrinário (relação com ponto forte/fraco/oportunidade/ameaça); (3) Justificativa de relevância e pertinência; (4) Consequência para a área de Segurança e Defesa; (5) Análise de Riscos — Probabilidade × Impacto no cumprimento da missão; (6) Consequências e impactos na Capacidade Operacional do Exército Brasileiro.",
    },
  ],
};

// ── Seção de Raciocínio Analítico (modo extended) ─────────────────────────────
const EXTENDED_BACKSTAGE = `
### 🧠 RACIOCÍNIO ANALÍTICO E LASTRO COGNITIVO
- **Nexo Causal:** explicite a cadeia lógica de pensamento que sustentou a conclusão acima.
- **Lastro TAD/MPC:** detalhe as avaliações de fonte aplicadas e como transitaram de [INDÍCIO] para [FATO].
- **Mitigação de Vieses:** como a auditoria ATHENA limpou distorções de ancoragem, efeito eco ou viés de confirmação nesta fase.`;

// ── Gerador principal ─────────────────────────────────────────────────────────

/**
 * Gera as instruções de estrutura do relatório final.
 * Retorna string vazia se a metodologia não for reconhecida (fallback gracioso).
 */
export function generateReportTemplateInstructions(
  methodologyRaw: string,
  layout: ReportLayout = "standard",
): string {
  const slug = normalizeMethodologySlug(methodologyRaw);
  if (!slug) return ""; // metodologia não mapeada — sem injeção

  const sections = METHODOLOGY_SECTIONS[slug];
  if (!sections?.length) return "";

  const isMilitary = slug === "eb70_mt_10401" || slug === "siex" || slug === "siplex";
  const militaryLabel: Record<string, string> = {
    eb70_mt_10401: "EB70-MT-10.401 (Estimativa de Inteligência)",
    siex: "SIEx/MPC (EB70-MT-10.401)",
    siplex: "CEEEx/SIPLEx — Cenários da Força Terrestre (EB20-N-03.002)",
  };
  const header = isMilitary
    ? `Você deve compilar o RELATÓRIO FINAL estruturado conforme a doutrina ${militaryLabel[slug]}.`
    : `Você deve compilar o RELATÓRIO FINAL estruturado conforme a metodologia ${methodologyRaw}.`;

  const baseInstruction = `
${header}
Obedeça RIGOROSAMENTE à taxonomia e aos títulos de seções abaixo.
PROIBIDO: alterar a grafia, omitir seções ou fundir cabeçalhos.
Cada seção deve sintetizar APENAS o que foi produzido e APROVADO pela esteira de agentes — sem inventar ou completar informações ausentes.
`;

  let body = "";
  for (const section of sections) {
    body += `\n## ${section.title}\n`;
    body += `> **Conteúdo obrigatório:** ${section.content}\n`;
    body += `[Insira aqui as conclusões e entregáveis aprovados para esta seção]\n`;

    if (layout === "extended") {
      body += EXTENDED_BACKSTAGE + "\n";
    }
  }

  return `${baseInstruction}\n${body}`;
}
