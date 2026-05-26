import { db, agents, methodologies, tools, methodologyTypes, methodologyPhases, agentMethodPrompts, techniques } from '@olympus/db';
import { eq, and } from 'drizzle-orm';

async function runSeed() {
  console.log('🌱 Iniciando seed declarativo do Olympus v4...');

  try {
    // ============================================================================
    // 1. FERRAMENTAS
    // ============================================================================
    console.log('⚙️  Semeando ferramentas...');
    const defaultTools = [
      {
        name: 'web_search',
        description: 'Busca na internet em tempo real para encontrar informações atualizadas.',
        schemaJson: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
      },
      {
        name: 'consultar_agente',
        description: 'Delega uma tarefa para um agente especialista da equipe.',
        schemaJson: { type: 'object', properties: { agent_name: { type: 'string' }, query: { type: 'string' } }, required: ['agent_name', 'query'] }
      }
    ];
    for (const t of defaultTools) {
      await db.insert(tools).values(t).onConflictDoUpdate({
        target: tools.name,
        set: { description: t.description, schemaJson: t.schemaJson }
      });
    }

    // ============================================================================
    // 2. AGENTES
    // ============================================================================
    console.log('🤖 Semeando agentes...');

    const WEB_RULE = `Você TEM acesso à internet via ferramenta "web_search". NUNCA afirme data de corte. Use web_search para dados atuais.`;

    const defaultAgents = [
      // ── HERMES (Orquestrador Agnóstico) ───────────────────────────────────────
      {
        name: 'HERMES',
        role: 'Orquestrador Principal',
        type: 'orchestrator',
        systemPrompt: `Você é HERMES, Orquestrador Principal do OLYMPUS (StratSight Brasil).
Você é a interface direta com o usuário e coordena a equipe de especialistas para a metodologia ativa.
VOCÊ NÃO TEM ACESSO DIRETO À INTERNET — delegue sempre via 'consultar_agente'.

[REGRA ABSOLUTA]
Você SEMPRE invoca 'consultar_agente' ANTES de qualquer resposta ao usuário.
Não existe situação — saudação, confirmação, status — em que você responde sem antes acionar um especialista.
Exceção única: durante a geração do RELATÓRIO FINAL, HERMES escreve diretamente a partir do histórico completo da conversa — NÃO chame consultar_agente nessa etapa.

[PROTOCOLO DE QUALIDADE — REVISÃO POR FASE]
Após receber a entrega de cada especialista, antes de apresentar o resultado ao usuário:
1. Acione: consultar_agente(agent_name="ATHENA", query="Revisar [Fase] — [Agente]: [síntese em até 200 chars]")
2. Se ATHENA retornar APROVADO ou APROVADO COM RESSALVAS: apresente o resultado + selo de qualidade de forma compacta.
3. Se ATHENA retornar REQUER REVISÃO: informe o usuário, acione o especialista para corrigir, repita a revisão.
Exceção: NÃO chame ATHENA após KRATOS (monitoramento) nem após o Relatório Final.

[RELATÓRIO FINAL]
Ao encerrar todas as fases da metodologia ativa, HERMES produz o relatório final DIRETAMENTE — sem acionar especialistas — relendo o histórico e extraindo exclusivamente o que foi APROVADO em cada fase.
Estrutura mínima: Resumo Executivo | Enquadramento | Análise | Cenários/Conclusões | Recomendações Estratégicas.
Após entregar: "Para iniciar um novo ciclo, clique em **Nova Sessão** na barra lateral." Encerre.

[PROIBIDO]
❌ Responder sem invocar consultar_agente (exceto no Relatório Final).
❌ Dizer "Vou delegar" sem realmente chamar a ferramenta.
❌ Chamar consultar_agente durante a geração do Relatório Final.

IMPORTANTE: Inicie SEMPRE a resposta final com "**HERMES** · ".`,
        toolsConfig: ['consultar_agente']
      },

      // ── SCOPUS ────────────────────────────────────────────────────────────────
      {
        name: 'SCOPUS',
        role: 'Especialista em Escopo e Premissas',
        type: 'expert',
        systemPrompt: `Você é SCOPUS, especialista em enquadramento estratégico e inteligência de fontes do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Delimitar o escopo do problema estratégico com precisão
- Identificar e avaliar variáveis-chave, tendências e forças motrizes do ambiente
- Mapear atores relevantes e suas posições, interesses e capacidades
- Coletar, filtrar e avaliar fontes com rigor analítico
- Aplicar frameworks de análise ambiental conforme a metodologia ativa

Ferramentas disponíveis: web_search, buscar_documentos_internos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa.

Padrões analíticos ICD 203:
- Distinguir fatos de julgamentos analíticos — usar declarar_julgamento para inferências
- Citar fontes com data e grau de confiabilidade (avaliar_fonte antes de dados críticos)
- Registrar hipóteses alternativas quando a principal tiver pontos fracos relevantes
- Identificar lacunas de informação e sinalizá-las explicitamente

Formato de entrega: análise estruturada com seções delimitadas, tabelas quando útil, conclusões explícitas ao final de cada seção.

IMPORTANTE: Inicie sempre com "**SCOPUS** · ".`,
        toolsConfig: ['web_search', 'buscar_documentos_internos', 'avaliar_fonte', 'declarar_julgamento', 'registrar_hipotese_alternativa']
      },

      // ── KLIO ──────────────────────────────────────────────────────────────────
      {
        name: 'KLIO',
        role: 'Especialista em Análise Ambiental e Tendências',
        type: 'expert',
        systemPrompt: `Você é KLIO, especialista em análise ambiental, histórica e de tendências estruturais do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Analisar o ambiente externo (político, econômico, social, tecnológico, ecológico, regulatório)
- Identificar tendências de longo prazo com base em dados históricos e trajetórias observáveis
- Realizar diagnóstico estratégico do sistema ou organização em análise
- Produzir sínteses analíticas densas com base em dados quantitativos e qualitativos

Ferramentas disponíveis: web_search, buscar_dados_publicos, buscar_documentos_internos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa, registrar_sinal, buscar_sinais.

Padrões analíticos ICD 203:
- Priorizar dados de fontes primárias (BCB, IBGE, IPEA, Banco Mundial, FMI, ONU)
- Distinguir tendências estruturais (décadas) de conjunturais (anos) — sinalizar a diferença
- Quantificar sempre que possível: valores, taxas, projeções com intervalo de confiança
- Sinalizar quando extrapolar além dos dados disponíveis (declarar_julgamento)

Formato de entrega: análise por domínio com dados de suporte, tendências identificadas e grau de certeza.

IMPORTANTE: Inicie sempre com "**KLIO** · ".`,
        toolsConfig: ['web_search', 'buscar_dados_publicos', 'buscar_documentos_internos', 'avaliar_fonte', 'declarar_julgamento', 'registrar_hipotese_alternativa', 'registrar_sinal', 'buscar_sinais']
      },

      // ── PYTHIA ────────────────────────────────────────────────────────────────
      {
        name: 'PYTHIA',
        role: 'Especialista em Cenários Prospectivos',
        type: 'expert',
        systemPrompt: `Você é PYTHIA, especialista em construção de cenários prospectivos e futuros alternativos do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Construir cenários coerentes, distintos e plausíveis a partir das análises do ambiente
- Articular hipóteses sobre como variáveis-chave podem evoluir de forma combinada
- Avaliar probabilidades de ocorrência de eventos e cenários
- Produzir narrativas estruturadas com lógica causal explícita
- Identificar indicadores de monitoramento por cenário

Ferramentas disponíveis: web_search, buscar_dados_publicos, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa.

Padrões analíticos ICD 203:
- Premissas de cada cenário devem ser explícitas
- Probabilidades devem ser justificadas, não arbitrárias (soma = 100% quando aplicável)
- Cada cenário tem lógica causal interna consistente — sem contradições com suas premissas
- Sinalizar onde há alta incerteza genuína versus consenso analítico

Formato de entrega: fichas de cenário com nome, premissas, narrativa, probabilidade, indicadores-sentinela.

IMPORTANTE: Inicie sempre com "**PYTHIA** · ".`,
        toolsConfig: ['web_search', 'buscar_dados_publicos', 'avaliar_fonte', 'declarar_julgamento', 'registrar_hipotese_alternativa']
      },

      // ── MNEMOSYNE ─────────────────────────────────────────────────────────────
      {
        name: 'MNEMOSYNE',
        role: 'Especialista em Narrativas de Cenários',
        type: 'expert',
        systemPrompt: `Você é MNEMOSYNE, especialista em narrativas estratégicas e síntese prospectiva do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Transformar análises técnicas em narrativas coerentes e comunicáveis
- Elaborar textos prospectivos que descrevam futuros possíveis de forma vívida e plausível
- Sintetizar múltiplas análises em documentos integrados

Ferramentas disponíveis: web_search.

Padrões de escrita:
- Narrativas escritas da perspectiva do horizonte temporal (futuro como presente)
- Plausibilidade sobre drama — evitar linguagem hedônica excessiva
- Começo (situação de partida), desenvolvimento (como chegamos aqui), estado final
- Consistência interna: eventos não podem contradizer premissas do cenário

Formato de entrega: narrativas em prosa fluída, 300-600 palavras por cenário.

IMPORTANTE: Inicie sempre com "**MNEMOSYNE** · ".`,
        toolsConfig: ['web_search']
      },

      // ── THEMIS ────────────────────────────────────────────────────────────────
      {
        name: 'THEMIS',
        role: 'Especialista em Implicações e Alertas',
        type: 'expert',
        systemPrompt: `Você é THEMIS, especialista em implicações estratégicas, riscos, oportunidades e alertas do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Derivar implicações estratégicas a partir dos cenários prospectivos
- Identificar riscos (ameaças com probabilidade e impacto estimados) e oportunidades
- Formular alertas estratégicos observáveis
- Produzir indicações estratégicas acionáveis

Ferramentas disponíveis: web_search, buscar_sinais, avaliar_fonte, declarar_julgamento, registrar_hipotese_alternativa.

Padrões analíticos ICD 203:
- Implicações específicas e acionáveis — não genéricas
- Distinguir curto prazo (<2 anos) de médio e longo prazo
- Alertas observáveis: "se X acontecer, isso indica Y"
- Indicações de caráter estratégico — orientam decisões de alto nível

Formato de entrega: tabela riscos/oportunidades por cenário + alertas + indicações.

IMPORTANTE: Inicie sempre com "**THEMIS** · ".`,
        toolsConfig: ['web_search', 'buscar_sinais', 'avaliar_fonte', 'declarar_julgamento', 'registrar_hipotese_alternativa']
      },

      // ── KRATOS ────────────────────────────────────────────────────────────────
      {
        name: 'KRATOS',
        role: 'Especialista em Monitoramento Contínuo',
        type: 'expert',
        systemPrompt: `Você é KRATOS, especialista em monitoramento contínuo de cenários, indicadores e sinais fracos do OLYMPUS (StratSight Brasil).
${WEB_RULE}

Suas responsabilidades centrais:
- Monitorar indicadores quantitativos e qualitativos do projeto
- Identificar e classificar sinais fracos e wild cards
- Avaliar o status atual dos cenários (qual está se materializando)
- Atualizar probabilidades com base em eventos recentes
- Emitir alertas quando indicadores atingirem limiares críticos

Ferramentas disponíveis: web_search, buscar_dados_publicos, buscar_sinais, registrar_sinal, atualizar_sentinela.

Formato do Relatório de Acompanhamento (padrão para qualquer metodologia):
1. STATUS GERAL: Verde/Amarelo/Vermelho com justificativa
2. INDICADORES: tabela com valor atual vs linha de base vs limiares
3. SINAIS DETECTADOS: novo / confirmando / contradizendo / ruído
4. CENÁRIO EM MATERIALIZAÇÃO: qual dos cenários a conjuntura atual mais se aproxima
5. ALERTAS: condições que exigem atenção imediata
6. RECOMENDAÇÃO: manter curso / revisar cenários / acionar ATHENA

IMPORTANTE: Inicie sempre com "**KRATOS** · ".`,
        toolsConfig: ['web_search', 'buscar_dados_publicos', 'buscar_sinais', 'registrar_sinal', 'atualizar_sentinela']
      },

      // ── ATHENA ────────────────────────────────────────────────────────
      {
        name: 'ATHENA',
        role: 'Revisor de Qualidade Analítica',
        type: 'expert',
        systemPrompt: `Você é ATHENA, especialista em revisão de qualidade analítica baseada nos padrões ICD 203 / ODNI 2022 e nos critérios do ATS (Analytic Tradecraft Standards).

Sua missão é revisar a análise produzida pelos agentes especialistas e verificar:

CONFORMIDADE ICD 203:
- Julgamentos analíticos declarados explicitamente (ferramenta declarar_julgamento foi usada?)
- Linguagem de probabilidade padronizada: quase certo / provável / possível / improvável / remoto
- Premissas subjacentes identificadas (especialmente premissas linchpin)
- Hipóteses alternativas consideradas e documentadas
- Fontes avaliadas com grau de confiabilidade (ferramenta avaliar_fonte foi usada?)

QUALIDADE PROSPECTIVA (para metodologias de cenários):
- Cenários são internamente coerentes (sem contradições)
- Premissas são explícitas
- Probabilidades somam 100% quando aplicável
- Indicadores de monitoramento são observáveis e específicos

COMPLETUDE DA METODOLOGIA ATIVA:
- Todas as fases foram endereçadas
- Produto esperado de cada fase está presente
- Lacunas de informação foram sinalizadas (não ocultadas)

FORMATO DE REVISÃO:
Para cada problema identificado:
1. Trecho ou fase específica
2. Classificação: Erro de Fato / Inconsistência Lógica / Lacuna / Linguagem Inadequada / Omissão de Hipótese Alternativa
3. Sugestão de correção

AVALIAÇÃO FINAL:
- Conformidade geral: Alta / Média / Baixa com justificativa
- Declaração de Propriedade Analítica: o analista confirma responsabilidade pelo produto?
- Recomendação: APROVADO / APROVADO COM RESSALVAS / REQUER REVISÃO

IMPORTANTE: Inicie sempre com "**ATHENA** · ".`,
        toolsConfig: ['avaliar_fonte', 'declarar_julgamento', 'registrar_hipotese_alternativa']
      },

      // ── OLYMPUS (Orquestrador de Planejamento Estratégico) ───────────────────
      {
        name: 'OLYMPUS',
        role: 'Orquestrador de Planejamento Estratégico e Produção do Conhecimento',
        type: 'orchestrator',
        systemPrompt: `Você é OLYMPUS, Orquestrador das Metodologias de Planejamento Estratégico e Produção do Conhecimento do sistema StratSight Brasil.
Você coordena as metodologias GRUMBACH - PLANEJAMENTO, SIEX - MPC e demais metodologias de planejamento conforme a metodologia ativa da sessão.
VOCÊ NÃO TEM ACESSO DIRETO À INTERNET. Delegue SEMPRE via 'consultar_agente'.

[REGRA ABSOLUTA]
Você SEMPRE invoca 'consultar_agente' ANTES de qualquer resposta ao usuário.
Não existe situação — saudação, confirmação, status — em que você responde sem antes acionar um especialista.
Exceção única: durante a geração do RELATÓRIO FINAL, OLYMPUS escreve diretamente a partir do histórico completo da conversa — NÃO chame consultar_agente nessa etapa.

[PROTOCOLO DE QUALIDADE — REVISÃO POR FASE]
Após receber a entrega de cada especialista, antes de apresentar o resultado ao usuário:
1. Acione: consultar_agente(agent_name="ATHENA", query="Revisar [Fase] — [Agente]: [síntese em até 200 chars]")
2. Se ATHENA retornar APROVADO ou APROVADO COM RESSALVAS: apresente o resultado + selo de qualidade.
3. Se ATHENA retornar REQUER REVISÃO: informe o usuário, acione o especialista para corrigir.
Exceção: NÃO chame ATHENA após KRATOS nem após o Relatório Final.

[FLUXO E RELATÓRIO FINAL]
O fluxo exato e o produto final dependem da metodologia ativa — as instruções específicas são injetadas via [METODOLOGIA ATIVA] abaixo.
Ao encerrar todas as fases, OLYMPUS produz o relatório final DIRETAMENTE — relendo o histórico e extraindo exclusivamente o que foi APROVADO em cada fase.
Após entregar: "Para iniciar um novo ciclo, clique em **Nova Sessão** na barra lateral." Encerre.

[PROIBIDO]
❌ Responder sem invocar consultar_agente (exceto no Relatório Final).
❌ Dizer "Vou delegar" sem realmente chamar a ferramenta.
❌ Chamar consultar_agente durante a geração do Relatório Final.

IMPORTANTE: Inicie SEMPRE a resposta final com "**OLYMPUS** · ".`,
        toolsConfig: ['consultar_agente']
      },

      // ── HERMES_SIPLEX ─────────────────────────────────────────────────────────
      {
        name: 'HERMES_SIPLEX',
        role: 'Orquestrador SIPLEx/EB',
        type: 'orchestrator',
        systemPrompt: `Você é HERMES_SIPLEX, orquestrador da Metodologia do Sistema de Planejamento do Exército (SIPLEx — EB20-N-03.002).
O SIPLEx é um ciclo de planejamento estratégico de 4 anos. VOCÊ NÃO TEM ACESSO DIRETO À INTERNET. Delegue SEMPRE via 'consultar_agente'.

[REGRA ABSOLUTA] Invoque 'consultar_agente' ANTES de qualquer resposta. Sem exceção.

[FLUXO SIPLEx — 7 FASES]

FASE 1 — MISSÃO DO EXÉRCITO
Delegue ao SCOPUS:
- Analisar e sintetizar a missão institucional
- Mapear a Cadeia de Valor Agregado (CVA) e macroprocessos finalísticos
- Definir Visão de Futuro e valores organizacionais
- Produto: enunciado de missão + CVA com macroprocessos

FASE 2 — ANÁLISE DO AMBIENTE ESTRATÉGICO (AAE) — horizonte 20 anos
Delegue a KLIO:
- Analisar o ambiente estratégico nacional e internacional
- Construir cenários prospectivos usando o método Grumbach/CEEEx (4 cenários)
- Produto: AAE completa com Cenário Mais Provável, Ideal, Alvo e Tendência

FASE 3 — POLÍTICA MILITAR TERRESTRE (PMT)
Com base na AAE:
- Definir Objetivos Estratégicos derivados dos cenários
- Identificar Fatores Críticos de Sucesso por objetivo
- Derivar indicações estratégicas dos cenários Alvo e Mais Provável
- Produto: PMT com objetivos, FCS e indicações

FASE 4 — ESTRATÉGIA MILITAR TERRESTRE (EMT)
Delegue a THEMIS:
- Formular estratégias por objetivo da PMT
- Definir ações estratégicas por estratégia
- Compatibilizar fins, maneiras e meios
- Produto: EMT com estratégias e ações estratégicas

FASE 5 — CONFECÇÃO DOS PLANOS ESTRATÉGICOS
Estruturar:
- Plano Estratégico do Exército (PEEx) — horizonte do Cenário Militar de Defesa
- Planos Estratégicos Setoriais (PES) por órgão setorial
- Produto: estrutura dos planos com diretrizes e responsáveis

FASE 6 — ORÇAMENTAÇÃO
Delegue a KRATOS:
- Associar ações estratégicas a programas orçamentários (PPA)
- Avaliar compatibilidade financeira
- Identificar lacunas de financiamento
- Produto: matriz ação estratégica × programa × recurso

FASE 7 — MEDIÇÃO DO DESEMPENHO E GESTÃO DE RISCOS
Delegue a KRATOS:
- Definir indicadores de desempenho por objetivo com metas e linhas de base
- Mapear riscos estratégicos (probabilidade × impacto)
- Definir planos de mitigação
- Produto: painel de indicadores + matriz de riscos

Antes do relatório final, acione ATHENA.

Produto final — RELATÓRIO SIPLEx — consolidando as 7 fases.

IMPORTANTE: Inicie SEMPRE com "**HERMES** · ".`,
        toolsConfig: ['consultar_agente']
      },
    ];

    for (const a of defaultAgents) {
      await db.insert(agents).values(a).onConflictDoUpdate({
        target: agents.name,
        set: { role: a.role, type: a.type, systemPrompt: a.systemPrompt, toolsConfig: a.toolsConfig }
      });
    }
    console.log(`   ✓ ${defaultAgents.length} agentes processados`);

    // ============================================================================
    // 3. METODOLOGIAS + SLUGS
    // ============================================================================
    console.log('📚 Semeando metodologias...');

    // agentsConfig inclui ATHENA em todas as metodologias que têm orquestrador
    const defaultMethodologies = [
      // ── 1. MSEF v3 — metodologia-mãe com 8 etapas ENAP ──────────────────────
      {
        name: 'MSEF v3 (8 etapas ENAP)', slug: 'msef',
        description: 'Metodologia Stratsight de Estudos do Futuro v3 — filtro Hendrikson, retrospectiva ENAP, estados booleanos e matematização Grumbach',
        category: 'Cenários Prospectivos', isDefault: true,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'MNEMOSYNE', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',    label: 'Triagem e Escopo',           node: 'node_framing' },
          { num: 2, agent: 'KLIO',      label: 'Varredura PESTEL',           node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',      label: 'Conjuntura de Forças',       node: 'node_scanning_forces' },
          { num: 4, agent: 'KLIO',      label: 'Linha do Tempo Histórica',   node: 'node_retrospective' },
          { num: 5, agent: 'PYTHIA',    label: 'Modelagem de Incertezas',    node: 'node_modeling' },
          { num: 6, agent: 'PYTHIA',    label: 'Configuração Espacial',      node: 'node_matrix_design' },
          { num: 7, agent: 'MNEMOSYNE', label: 'Escrita de Enredos',         node: 'node_narrative' },
          { num: 8, agent: 'THEMIS',    label: 'Salvaguardas e Alertas',     node: 'node_integration' },
        ]}
      },
      // ── 2. Grumbach: Produção de Cenários — 9 fases com painel de peritos ───
      {
        name: 'Grumbach: Produção de Cenários', slug: 'grumbach',
        description: 'Método Grumbach (CEEEx/EB) — escola probabilística com painel simulado de peritos, eventos booleanos e matematização real P(i) e P(i|j)',
        category: 'Cenários Prospectivos', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'MNEMOSYNE', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',    label: 'Planejamento e Delimitação',        node: 'node_framing' },
          { num: 2, agent: 'KLIO',      label: 'Diagnóstico Estratégico — FPFs',    node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',      label: 'Avaliação MPC Alfanumérica',        node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',    label: 'Painel de Peritos — P(i)',          node: 'node_modeling' },
          { num: 5, agent: 'PYTHIA',    label: 'Probabilidades Condicionais P(i|j)',node: 'node_modeling' },
          { num: 6, agent: 'PYTHIA',    label: 'Seleção de Cenas Mais Prováveis',   node: 'node_matrix_design' },
          { num: 7, agent: 'MNEMOSYNE', label: 'Narrativas dos 4 Cenários CEEEx',   node: 'node_narrative' },
          { num: 8, agent: 'THEMIS',    label: 'Indicações Estratégicas',           node: 'node_integration' },
          { num: 9, agent: 'KRATOS',    label: 'Divulgação e Monitoramento',        node: 'node_integration' },
        ]}
      },
      // ── 3. Godet: Escola Estrutural — 7 fases MICMAC/MACTOR/MORPHOL/SMIC ───
      {
        name: 'Godet: Escola Estrutural', slug: 'godet',
        description: 'Método Godet (LIPSOR/CNAM) — escola francesa com ferramentas determinísticas: MICMAC, MACTOR, MORPHOL, SMIC e MULTIPOL',
        category: 'Cenários Prospectivos', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'MNEMOSYNE', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',    label: 'Delimitação do Sistema',         node: 'node_framing' },
          { num: 2, agent: 'KLIO',      label: 'MICMAC — Variáveis-chave',       node: 'node_modeling' },
          { num: 3, agent: 'KLIO',      label: 'MACTOR — Análise de Atores',     node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',    label: 'Análise Morfológica (MORPHOL)',   node: 'node_matrix_design' },
          { num: 5, agent: 'PYTHIA',    label: 'SMIC — Probabilidades Cruzadas', node: 'node_modeling' },
          { num: 6, agent: 'MNEMOSYNE', label: 'Narrativas dos Cenários Godet',  node: 'node_narrative' },
          { num: 7, agent: 'HERMES',    label: 'Opções Estratégicas (MULTIPOL)', node: 'node_integration' },
        ]}
      },
      // ── 4. OTAN/AltA — mantida, node_slug adicionado ────────────────────────
      {
        name: 'OTAN/AltA', slug: 'alta',
        description: 'NATO Alternative Analysis — AltA Handbook 2017: técnicas SAT para análise de hipóteses alternativas e vieses cognitivos',
        category: 'Cenários Prospectivos', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'HERMES',  label: 'Iniciação',                  node: 'node_framing' },
          { num: 2, agent: 'SCOPUS',  label: 'Preparação — Técnicas SAT',  node: 'node_scanning_macro' },
          { num: 3, agent: 'PYTHIA',  label: 'Aplicação das Técnicas',     node: 'node_modeling' },
          { num: 4, agent: 'HERMES',  label: 'Encerramento e Produto',     node: 'node_integration' },
          { num: 5, agent: 'KRATOS',  label: 'Monitoramento de Hipóteses', node: 'node_integration' },
        ]}
      },
      // ── 5. MPC: Conhecimento Estimativa EB — 6 fases com avaliação alfanumérica
      {
        name: 'MPC: Conhecimento Estimativa EB', slug: 'siex',
        description: 'Metodologia de Produção do Conhecimento EB70-MT-10.401 — Estimativa com avaliação alfanumérica MPC (A-F × 1-6) e relatório padronizado',
        category: 'Produção do Conhecimento', isDefault: false,
        sourceDoc: 'EB70-MT-10.401',
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',  label: 'Planejamento',                  node: 'node_framing' },
          { num: 2, agent: 'KLIO',    label: 'Reunião',                       node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',    label: 'Análise e Síntese',             node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',  label: 'Interpretação',                 node: 'node_modeling' },
          { num: 5, agent: 'THEMIS',  label: 'Formalização e Difusão',        node: 'node_narrative' },
          { num: 6, agent: 'KRATOS',  label: 'Monitoramento de Indicadores',  node: 'node_integration' },
        ]}
      },
      // ── 6. SIPLEx/CEEEx — 8 fases com PBC e separação tendências×inflexões ─
      {
        name: 'SIPLEx/CEEEx: Cenários da Força Terrestre', slug: 'siplex',
        description: 'Sistema de Planejamento do Exército EB20-N-03.002 — 8 fases com Planejamento Baseado em Capacidades e separação analítica tendências vs fatores de inflexão',
        category: 'Planejamento Estratégico', isDefault: false,
        sourceDoc: 'EB20-N-03.002',
        agentsConfig: { agents: ['HERMES_SIPLEX', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',        label: 'Missão do Exército',                      node: 'node_framing' },
          { num: 2, agent: 'KLIO',          label: 'AAE — Ambiente Estratégico',              node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',          label: 'Tendências Estruturantes',                node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',        label: 'Incertezas e Fatores de Inflexão',        node: 'node_modeling' },
          { num: 5, agent: 'HERMES_SIPLEX', label: 'Política Militar Terrestre (PMT)',        node: 'node_matrix_design' },
          { num: 6, agent: 'THEMIS',        label: 'Estratégia Militar Terrestre (EMT)',      node: 'node_integration' },
          { num: 7, agent: 'HERMES_SIPLEX', label: 'Confecção dos Planos Estratégicos',      node: 'node_integration' },
          { num: 8, agent: 'KRATOS',        label: 'Orçamentação e Desempenho',              node: 'node_integration' },
        ]}
      },
      // ── 7. IPEA/FGV — 7 fases de cenários estreitados de desenvolvimento ───
      {
        name: 'IPEA/FGV: Cenários Estreitados de Desenvolvimento', slug: 'macroplan',
        description: 'Metodologia IPEA/FGV de cenários estratégicos com estreitamento progressivo por dimensões de desenvolvimento e análise de forças estruturais',
        category: 'Cenários Prospectivos', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',  label: 'Enquadramento e Horizonte',    node: 'node_framing' },
          { num: 2, agent: 'KLIO',    label: 'Macrotendências Globais',      node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',    label: 'Dimensões de Desenvolvimento', node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',  label: 'Incertezas Críticas',          node: 'node_modeling' },
          { num: 5, agent: 'PYTHIA',  label: 'Cenários Estreitados',         node: 'node_matrix_design' },
          { num: 6, agent: 'THEMIS',  label: 'Implicações Estratégicas',     node: 'node_integration' },
          { num: 7, agent: 'HERMES',  label: 'Síntese e Conclusão',          node: 'node_integration' },
        ]}
      },
      // ── 8. MPO: Estratégia Brasil 2050 — 8 fases com backcasting normativo ─
      {
        name: 'MPO: Estratégia Brasil 2050', slug: 'mpo',
        description: 'Método de Planejamento por Objetivos — Estratégia Brasil 2050 com cenário normativo alvo e backcasting por marcos intermediários',
        category: 'Planejamento Estratégico', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',  label: 'Visão e Diagnóstico',               node: 'node_framing' },
          { num: 2, agent: 'KLIO',    label: 'Análise de Contexto',               node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',    label: 'Forças e Atores Estratégicos',      node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',  label: 'Cenário Normativo Alvo',            node: 'node_modeling' },
          { num: 5, agent: 'PYTHIA',  label: 'Backcasting — Marcos Intermediários',node: 'node_matrix_design' },
          { num: 6, agent: 'THEMIS',  label: 'Objetivos e Plano de Ação',         node: 'node_integration' },
          { num: 7, agent: 'HERMES',  label: 'Plano MPO Consolidado',             node: 'node_integration' },
          { num: 8, agent: 'KRATOS',  label: 'Acompanhamento de Metas',           node: 'node_integration' },
        ]}
      },
      // ── 9. ASPLAN/MD — 7 fases soberanas com eixos de inflexão geopolítica ─
      {
        name: 'ASPLAN/MD: Planejamento Setorial de Defesa', slug: 'asplan',
        description: 'Metodologia do Ministério da Defesa para o Planejamento Estratégico Setorial de Defesa — 7 fases soberanas com eixos de inflexão geopolítica',
        category: 'Planejamento Estratégico', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',  label: 'Enquadramento Soberano',              node: 'node_framing' },
          { num: 2, agent: 'KLIO',    label: 'Análise do Ambiente',                 node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',    label: 'Eixos de Inflexão Geopolítica',       node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',  label: 'Cenários de Ameaças e Oportunidades', node: 'node_modeling' },
          { num: 5, agent: 'THEMIS',  label: 'Indicações Estratégicas',             node: 'node_integration' },
          { num: 6, agent: 'HERMES',  label: 'Produto ASPLAN',                      node: 'node_integration' },
          { num: 7, agent: 'KRATOS',  label: 'Acompanhamento e Revisão',            node: 'node_integration' },
        ]}
      },
      // ── 10. GBN (Peter Schwartz) — 8 fases com lógica intuitiva ortogonal ──
      {
        name: 'GBN (Global Business Network - Peter Schwartz)', slug: 'futures',
        description: 'Método GBN de Peter Schwartz — escola intuitiva com Futures Cone, forças motrizes, Matriz 2×2 e narrativas CLA (Causal Layered Analysis)',
        category: 'Cenários Prospectivos', isDefault: false,
        agentsConfig: { agents: ['HERMES', 'SCOPUS', 'KLIO', 'PYTHIA', 'MNEMOSYNE', 'THEMIS', 'KRATOS', 'ATHENA'], steps: [
          { num: 1, agent: 'SCOPUS',    label: 'Enquadramento e Questão Focal',   node: 'node_framing' },
          { num: 2, agent: 'KLIO',      label: 'Sinais e Tendências',             node: 'node_scanning_macro' },
          { num: 3, agent: 'KLIO',      label: 'Análise de Forças Motrizes',      node: 'node_scanning_forces' },
          { num: 4, agent: 'PYTHIA',    label: 'Critérios de Distinção',          node: 'node_modeling' },
          { num: 5, agent: 'PYTHIA',    label: 'Futuros Alternativos — Matriz 2×2',node: 'node_matrix_design' },
          { num: 6, agent: 'MNEMOSYNE', label: 'Narrativas de Futuros (CLA)',     node: 'node_narrative' },
          { num: 7, agent: 'THEMIS',    label: 'Implicações e Alertas',           node: 'node_integration' },
          { num: 8, agent: 'KRATOS',    label: 'Monitoramento de Futuros',        node: 'node_integration' },
        ]}
      },
    ];

    for (const m of defaultMethodologies) {
      await db.insert(methodologies).values(m as any).onConflictDoUpdate({
        target: methodologies.slug,
        set: {
          name: m.name,
          description: m.description,
          category: m.category,
          isDefault: m.isDefault,
          agentsConfig: m.agentsConfig,
          ...((m as any).sourceDoc ? { sourceDoc: (m as any).sourceDoc } : {}),
        }
      });
    }
    console.log(`   ✓ ${defaultMethodologies.length} metodologias processadas (upsert por slug)`);

    // ============================================================================
    // 4. TIPOS DE METODOLOGIA (N:N)
    // ============================================================================
    console.log('🏷️  Semeando tipos de metodologia...');

    // Mapa: slug da metodologia → categorias adicionais (além da principal já em category)
    const extraCategories: Record<string, string[]> = {
      'grumbach': ['Planejamento Estratégico'], // Grumbach também é Planejamento Estratégico
      'siex':     ['Cenários Prospectivos'],    // MPC/SIEX também produz cenários
    };

    for (const [methodSlug, cats] of Object.entries(extraCategories)) {
      const method = await db.query.methodologies.findFirst({ where: eq(methodologies.slug, methodSlug) });
      if (!method) { console.warn(`   ⚠ Metodologia não encontrada: ${methodSlug}`); continue; }

      for (const cat of cats) {
        await db.insert(methodologyTypes).values({ methodologyId: method.id, category: cat })
          .onConflictDoNothing();
      }
    }
    console.log('   ✓ Tipos de metodologia processados');

    // ============================================================================
    // 5. FASES DAS METODOLOGIAS
    // ============================================================================
    console.log('📋 Semeando fases das metodologias...');

    // Fases por slug de metodologia — inclui slug (único) e nodeSlug para LangGraph
    type PhaseEntry = { phaseNum: number; slug: string; nodeSlug: string; label: string; agentRole: string; description?: string };
    const phasesBySlug: Record<string, PhaseEntry[]> = {
      // ── MSEF v3 (8 etapas) ─────────────────────────────────────────────────
      msef: [
        { phaseNum: 1, slug: 'msef_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',    label: 'Triagem e Escopo',            description: 'Filtro Hendrikson: tipo de questão (Divergente/Convergente/Cascata/Contrafactual) + Ficha de Escopo + KAC' },
        { phaseNum: 2, slug: 'msef_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',      label: 'Varredura PESTEL',            description: 'PESTEL expandido + radar de sinais fracos + megatendências + FPFs propostos com avaliação MPC' },
        { phaseNum: 3, slug: 'msef_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',      label: 'Conjuntura de Forças',        description: 'Mini-SAT de atores: mapeamento de forças, capacidades e vulnerabilidades + MACTOR simplificado' },
        { phaseNum: 4, slug: 'msef_p4', nodeSlug: 'node_retrospective',   agentRole: 'KLIO',      label: 'Linha do Tempo Histórica',    description: 'RAG sobre documentos de conjuntura + delineamento de trajetória histórica + Cones de Janus' },
        { phaseNum: 5, slug: 'msef_p5', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',    label: 'Modelagem de Incertezas',     description: 'Classificação de incertezas estruturais + MICMAC determinístico + ACH se hipóteses conflitantes' },
        { phaseNum: 6, slug: 'msef_p6', nodeSlug: 'node_matrix_design',   agentRole: 'PYTHIA',    label: 'Configuração Espacial',       description: 'Seleção: Matriz 2×2 (eixos ortogonais) OU Tabela Morfológica (≥3 incertezas indissociáveis)' },
        { phaseNum: 7, slug: 'msef_p7', nodeSlug: 'node_narrative',       agentRole: 'MNEMOSYNE', label: 'Escrita de Enredos',          description: 'Narrativas com travas probabilísticas Hendrikson + Red Team Analysis interno por cenário' },
        { phaseNum: 8, slug: 'msef_p8', nodeSlug: 'node_integration',     agentRole: 'THEMIS',    label: 'Salvaguardas e Alertas',      description: 'Planos de 3 Horizontes + Signposts of Change + Matriz hedges×bets + relatório final HERMES' },
      ],
      // ── Grumbach: Produção de Cenários (9 fases) ───────────────────────────
      grumbach: [
        { phaseNum: 1, slug: 'grumbach_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',    label: 'Planejamento e Delimitação',         description: 'Definição do sistema prospectivo, horizonte temporal, atores e FPFs iniciais' },
        { phaseNum: 2, slug: 'grumbach_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',      label: 'Diagnóstico Estratégico — FPFs',     description: 'Identificação dos Fatos Portadores de Futuro + eventos booleanos com descrições precisas' },
        { phaseNum: 3, slug: 'grumbach_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',      label: 'Avaliação MPC Alfanumérica',         description: 'Avaliação de cada FPF: Idoneidade A-F × Credibilidade 1-6 (EB70-MT-10.401)' },
        { phaseNum: 4, slug: 'grumbach_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',    label: 'Painel de Peritos — P(i)',           description: 'Simulação do painel: 7 especialistas + probabilidades simples P(i) por FPF aprovado' },
        { phaseNum: 5, slug: 'grumbach_p5', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',    label: 'Probabilidades Condicionais P(i|j)', description: 'Cálculo de P(i|j ocorre) e P(i|j não ocorre) para pares relevantes de FPFs' },
        { phaseNum: 6, slug: 'grumbach_p6', nodeSlug: 'node_matrix_design',   agentRole: 'PYTHIA',    label: 'Seleção de Cenas Mais Prováveis',    description: 'Combinação booleana OCORRE/NÃO OCORRE + seleção das cenas com maior consistência' },
        { phaseNum: 7, slug: 'grumbach_p7', nodeSlug: 'node_narrative',       agentRole: 'MNEMOSYNE', label: 'Narrativas dos 4 Cenários CEEEx',    description: 'Narrativas: Mais Provável, Ideal (Otimista), Alvo (Normativo) e Tendência (Inercial)' },
        { phaseNum: 8, slug: 'grumbach_p8', nodeSlug: 'node_integration',     agentRole: 'THEMIS',    label: 'Indicações Estratégicas',            description: 'Tabela evento × oportunidades/ameaças × indicações estratégicas por cenário' },
        { phaseNum: 9, slug: 'grumbach_p9', nodeSlug: 'node_integration',     agentRole: 'KRATOS',    label: 'Divulgação e Monitoramento',         description: 'QME + indicadores de acompanhamento por evento + frequência de revisão' },
      ],
      // ── Godet: Escola Estrutural (7 fases) ─────────────────────────────────
      godet: [
        { phaseNum: 1, slug: 'godet_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',    label: 'Delimitação do Sistema',         description: 'Definição das fronteiras do sistema + identificação de variáveis internas e externas para MICMAC' },
        { phaseNum: 2, slug: 'godet_p2', nodeSlug: 'node_modeling',        agentRole: 'KLIO',      label: 'MICMAC — Variáveis-chave',       description: 'Matriz de influências cruzadas N×N + potência M^k (k=4) + classificação: motriz/alvo/reguladora/autônoma' },
        { phaseNum: 3, slug: 'godet_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',      label: 'MACTOR — Análise de Atores',     description: 'Matrizes de influência e dependência de atores + quadrante MOTOR/RELÉ/DEPENDENTE/AUTÔNOMO' },
        { phaseNum: 4, slug: 'godet_p4', nodeSlug: 'node_matrix_design',   agentRole: 'PYTHIA',    label: 'Análise Morfológica (MORPHOL)',   description: 'Espaço morfológico global + redução por restrições de compatibilidade + combinações coerentes de cenários' },
        { phaseNum: 5, slug: 'godet_p5', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',    label: 'SMIC — Probabilidades Cruzadas', description: 'Painel de especialistas + probabilidades simples P(i) e condicionais P(i|j) + cenários mais prováveis' },
        { phaseNum: 6, slug: 'godet_p6', nodeSlug: 'node_narrative',       agentRole: 'MNEMOSYNE', label: 'Narrativas dos Cenários Godet',  description: 'Narrativas de referência e contrastadas para os cenários selecionados pelo SMIC' },
        { phaseNum: 7, slug: 'godet_p7', nodeSlug: 'node_integration',     agentRole: 'HERMES',    label: 'Opções Estratégicas (MULTIPOL)', description: 'RAPPORT PROSPECTIF GODET — MICMAC + MACTOR + morfologia + cenários + opções + monitoramento' },
      ],
      // ── OTAN/AltA (5 fases — sem mudança de conteúdo, node_slug adicionado) ─
      alta: [
        { phaseNum: 1, slug: 'alta_p1', nodeSlug: 'node_framing',        agentRole: 'HERMES',  label: 'Iniciação',                  description: 'Definição do problema analítico + seleção das técnicas SAT mais adequadas' },
        { phaseNum: 2, slug: 'alta_p2', nodeSlug: 'node_scanning_macro', agentRole: 'SCOPUS',  label: 'Preparação — Técnicas SAT',  description: 'KAC: mapeamento de premissas-chave e vieses cognitivos que podem distorcer a análise' },
        { phaseNum: 3, slug: 'alta_p3', nodeSlug: 'node_modeling',       agentRole: 'PYTHIA',  label: 'Aplicação das Técnicas',     description: 'Red Teaming, Devil\'s Advocate, Alternative Futures Analysis, ACH — execução real das SATs' },
        { phaseNum: 4, slug: 'alta_p4', nodeSlug: 'node_integration',    agentRole: 'HERMES',  label: 'Encerramento e Produto',     description: 'PRODUTO ALTA FINAL — hipóteses alternativas validadas + implicações + recomendações analíticas' },
        { phaseNum: 5, slug: 'alta_p5', nodeSlug: 'node_integration',    agentRole: 'KRATOS',  label: 'Monitoramento de Hipóteses', description: 'Indicadores de disparo para cada hipótese alternativa + frequência de reavaliação' },
      ],
      // ── MPC: Conhecimento Estimativa EB (6 fases) ──────────────────────────
      siex: [
        { phaseNum: 1, slug: 'siex_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',  label: 'Planejamento',                description: 'Necessidades de Inteligência + Ficha de Planejamento + AEC/AECK + fatos essenciais' },
        { phaseNum: 2, slug: 'siex_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',    label: 'Reunião',                     description: 'Coleta sistemática por AECK + fontes abertas + ativação RAG nos documentos de escopo' },
        { phaseNum: 3, slug: 'siex_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',    label: 'Análise e Síntese',           description: 'Avaliação alfanumérica A-F × 1-6 por fonte/dado + pertinência + frações significativas' },
        { phaseNum: 4, slug: 'siex_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',  label: 'Interpretação',               description: 'Fatores de influência + trajetória + hipóteses de LA hierarquizadas por probabilidade' },
        { phaseNum: 5, slug: 'siex_p5', nodeSlug: 'node_narrative',       agentRole: 'THEMIS',  label: 'Formalização e Difusão',      description: 'Implicações por hipótese de LA + indicadores de alerta + Estimativa EB formato padronizado' },
        { phaseNum: 6, slug: 'siex_p6', nodeSlug: 'node_integration',     agentRole: 'KRATOS',  label: 'Monitoramento de Indicadores',description: 'Indicadores de alerta precoce por LA + revisão periódica da Estimativa' },
      ],
      // ── SIPLEx/CEEEx: Cenários da Força Terrestre (8 fases) ────────────────
      siplex: [
        { phaseNum: 1, slug: 'siplex_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',        label: 'Missão do Exército',                      description: 'Missão + Cadeia de Valor + Visão de Futuro + valores institucionais' },
        { phaseNum: 2, slug: 'siplex_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',          label: 'AAE — Ambiente Estratégico',               description: 'Análise estratégica nacional e internacional — horizonte 20 anos + cenários CEEEx' },
        { phaseNum: 3, slug: 'siplex_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',          label: 'Tendências Estruturantes',                 description: 'Identificação e separação analítica: tendências de longo prazo vs fatores de inflexão geopolítica' },
        { phaseNum: 4, slug: 'siplex_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',        label: 'Incertezas e Fatores de Inflexão',         description: 'Modelagem das incertezas críticas + avaliação de impacto dos fatores de inflexão sobre a Força' },
        { phaseNum: 5, slug: 'siplex_p5', nodeSlug: 'node_matrix_design',   agentRole: 'HERMES_SIPLEX', label: 'Política Militar Terrestre (PMT)',          description: 'Objetivos estratégicos + FCS + indicações derivadas dos cenários aprovados' },
        { phaseNum: 6, slug: 'siplex_p6', nodeSlug: 'node_integration',     agentRole: 'THEMIS',        label: 'Estratégia Militar Terrestre (EMT)',        description: 'Estratégias e ações estratégicas por objetivo da PMT + PBC (Planejamento Baseado em Capacidades)' },
        { phaseNum: 7, slug: 'siplex_p7', nodeSlug: 'node_integration',     agentRole: 'HERMES_SIPLEX', label: 'Confecção dos Planos Estratégicos',         description: 'PEEx + PES por órgão setorial + integração com o SIPADE' },
        { phaseNum: 8, slug: 'siplex_p8', nodeSlug: 'node_integration',     agentRole: 'KRATOS',        label: 'Orçamentação e Desempenho',                description: 'Matriz ação estratégica × PPA × recurso + painel de indicadores + gestão de riscos' },
      ],
      // ── IPEA/FGV: Cenários Estreitados de Desenvolvimento (7 fases) ─────────
      macroplan: [
        { phaseNum: 1, slug: 'macroplan_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',  label: 'Enquadramento e Horizonte',    description: 'Definição do horizonte temporal, sistema em análise e questão estratégica focal' },
        { phaseNum: 2, slug: 'macroplan_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',    label: 'Macrotendências Globais',      description: 'Drivers globais e macrotendências estruturais: análise quantitativa e qualitativa de forças de longo prazo' },
        { phaseNum: 3, slug: 'macroplan_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',    label: 'Dimensões de Desenvolvimento', description: 'Análise setorial por dimensões (econômica, social, tecnológica, ambiental) + fatores de desenvolvimento nacional' },
        { phaseNum: 4, slug: 'macroplan_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',  label: 'Incertezas Críticas',          description: 'Mapeamento e modelagem das incertezas críticas que polarizam os cenários + Impacto×Incerteza' },
        { phaseNum: 5, slug: 'macroplan_p5', nodeSlug: 'node_matrix_design',   agentRole: 'PYTHIA',  label: 'Cenários Estreitados',         description: 'Estreitamento progressivo do espaço de futuros + configuração dos cenários por dimensão de desenvolvimento' },
        { phaseNum: 6, slug: 'macroplan_p6', nodeSlug: 'node_integration',     agentRole: 'THEMIS',  label: 'Implicações Estratégicas',     description: 'Riscos, oportunidades e opções estratégicas por cenário + indicadores de acompanhamento' },
        { phaseNum: 7, slug: 'macroplan_p7', nodeSlug: 'node_integration',     agentRole: 'HERMES',  label: 'Síntese e Conclusão',          description: 'RELATÓRIO IPEA/FGV consolidando macrotendências, cenários estreitados e implicações estratégicas' },
      ],
      // ── MPO: Estratégia Brasil 2050 (8 fases com backcasting) ───────────────
      mpo: [
        { phaseNum: 1, slug: 'mpo_p1', nodeSlug: 'node_framing',        agentRole: 'SCOPUS',  label: 'Visão e Diagnóstico',               description: 'Missão institucional + problemas prioritários + mapeamento de stakeholders + restrições' },
        { phaseNum: 2, slug: 'mpo_p2', nodeSlug: 'node_scanning_macro', agentRole: 'KLIO',    label: 'Análise de Contexto',               description: 'Ambiente externo, tendências relevantes e fatores críticos para os objetivos de longo prazo' },
        { phaseNum: 3, slug: 'mpo_p3', nodeSlug: 'node_scanning_forces',agentRole: 'KLIO',    label: 'Forças e Atores Estratégicos',      description: 'Mapeamento de atores e forças com capacidade de apoiar ou bloquear a visão de futuro' },
        { phaseNum: 4, slug: 'mpo_p4', nodeSlug: 'node_modeling',       agentRole: 'PYTHIA',  label: 'Cenário Normativo Alvo',            description: 'Definição do cenário-alvo desejado (Brasil 2050) + estados booleanos dos eventos aprovados' },
        { phaseNum: 5, slug: 'mpo_p5', nodeSlug: 'node_matrix_design',  agentRole: 'PYTHIA',  label: 'Backcasting — Marcos Intermediários',description: 'Retroprospecção do cenário alvo: H+5/H+10/H+20/H+30 + capacidades e marcos regulatórios' },
        { phaseNum: 6, slug: 'mpo_p6', nodeSlug: 'node_integration',    agentRole: 'THEMIS',  label: 'Objetivos e Plano de Ação',         description: 'Objetivos SMART derivados do backcasting + metas mensuráveis + responsáveis e prazos' },
        { phaseNum: 7, slug: 'mpo_p7', nodeSlug: 'node_integration',    agentRole: 'HERMES',  label: 'Plano MPO Consolidado',             description: 'PLANO MPO: diagnóstico + cenário normativo + backcasting + objetivos + metas + plano de ação' },
        { phaseNum: 8, slug: 'mpo_p8', nodeSlug: 'node_integration',    agentRole: 'KRATOS',  label: 'Acompanhamento de Metas',           description: 'Painel de indicadores de meta + revisão de progresso + alertas de desvio + signposts' },
      ],
      // ── ASPLAN/MD: Planejamento Setorial de Defesa (7 fases soberanas) ──────
      asplan: [
        { phaseNum: 1, slug: 'asplan_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',  label: 'Enquadramento Soberano',              description: 'Sistema em análise soberana + atores estratégicos + fronteiras + questão estratégica de defesa' },
        { phaseNum: 2, slug: 'asplan_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',    label: 'Análise do Ambiente',                 description: 'Diagnóstico estratégico de defesa — oportunidades, ameaças, tendências com dados de soberania' },
        { phaseNum: 3, slug: 'asplan_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',    label: 'Eixos de Inflexão Geopolítica',       description: 'Identificação dos eixos de inflexão que definem o espaço de futuros para a defesa nacional' },
        { phaseNum: 4, slug: 'asplan_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',  label: 'Cenários de Ameaças e Oportunidades', description: 'Cenários estratégicos alternativos para o horizonte de planejamento setorial de defesa' },
        { phaseNum: 5, slug: 'asplan_p5', nodeSlug: 'node_integration',     agentRole: 'THEMIS',  label: 'Indicações Estratégicas',             description: 'Implicações por cenário e indicações estratégicas soberanas para o decisor de defesa' },
        { phaseNum: 6, slug: 'asplan_p6', nodeSlug: 'node_integration',     agentRole: 'HERMES',  label: 'Produto ASPLAN',                      description: 'PRODUTO ASPLAN/MD: enquadramento + análise + eixos de inflexão + cenários + indicações soberanas' },
        { phaseNum: 7, slug: 'asplan_p7', nodeSlug: 'node_integration',     agentRole: 'KRATOS',  label: 'Acompanhamento e Revisão',            description: 'Revisão periódica do ASPLAN + indicadores de implementação das ações estratégicas de defesa' },
      ],
      // ── GBN (Peter Schwartz): Lógica Intuitiva Ortogonal (8 fases) ──────────
      futures: [
        { phaseNum: 1, slug: 'futures_p1', nodeSlug: 'node_framing',         agentRole: 'SCOPUS',    label: 'Enquadramento e Questão Focal',   description: 'Delimitação do tema, horizonte temporal, questão focal e atores relevantes (GBN Step 1)' },
        { phaseNum: 2, slug: 'futures_p2', nodeSlug: 'node_scanning_macro',  agentRole: 'KLIO',      label: 'Sinais e Tendências',             description: 'Sinais fracos, wild cards, tendências emergentes — Futures Cone (Possível/Plausível/Provável/Preferível)' },
        { phaseNum: 3, slug: 'futures_p3', nodeSlug: 'node_scanning_forces', agentRole: 'KLIO',      label: 'Análise de Forças Motrizes',      description: 'Forças motrizes (driving forces) por STEEP + ranking Impacto×Incerteza para seleção dos eixos' },
        { phaseNum: 4, slug: 'futures_p4', nodeSlug: 'node_modeling',        agentRole: 'PYTHIA',    label: 'Critérios de Distinção',          description: 'Seleção dos 2 eixos mais críticos e incertos + definição dos extremos para a Matriz 2×2' },
        { phaseNum: 5, slug: 'futures_p5', nodeSlug: 'node_matrix_design',   agentRole: 'PYTHIA',    label: 'Futuros Alternativos — Matriz 2×2',description: 'Construção dos 4 quadrantes + nomeação dos futuros + signalizadores por quadrante' },
        { phaseNum: 6, slug: 'futures_p6', nodeSlug: 'node_narrative',       agentRole: 'MNEMOSYNE', label: 'Narrativas de Futuros (CLA)',     description: 'Narrativas em 4 camadas CLA: eventos → sistemas → visão de mundo → mitos/metáforas' },
        { phaseNum: 7, slug: 'futures_p7', nodeSlug: 'node_integration',     agentRole: 'THEMIS',    label: 'Implicações e Alertas',           description: 'Implicações cross-cenário + estratégias robustas + hedges×bets + indicadores de monitoramento' },
        { phaseNum: 8, slug: 'futures_p8', nodeSlug: 'node_integration',     agentRole: 'KRATOS',    label: 'Monitoramento de Futuros',        description: 'Indicadores de sinalização antecipada (early signals) + revisão periódica dos futuros alternativos' },
      ],
    };

    for (const [methSlug, phases] of Object.entries(phasesBySlug)) {
      const method = await db.query.methodologies.findFirst({ where: eq(methodologies.slug, methSlug) });
      if (!method) { console.warn(`   ⚠ Metodologia não encontrada: ${methSlug}`); continue; }

      for (const phase of phases) {
        // Encontrar pelo par (methodologyId + phaseNum) — primeira execução não tem slug no banco
        const existing = await db.query.methodologyPhases.findFirst({
          where: (t, { and, eq: eqFn }) => and(
            eqFn(t.methodologyId, method.id),
            eqFn(t.phaseNum, phase.phaseNum)
          )
        });

        if (existing) {
          await db.update(methodologyPhases).set({
            label: phase.label,
            agentRole: phase.agentRole,
            description: phase.description ?? null,
            slug: phase.slug,
            nodeSlug: phase.nodeSlug,
          }).where(eq(methodologyPhases.id, existing.id));
        } else {
          await db.insert(methodologyPhases).values({
            methodologyId: method.id,
            phaseNum: phase.phaseNum,
            label: phase.label,
            agentRole: phase.agentRole,
            description: phase.description ?? null,
            slug: phase.slug,
            nodeSlug: phase.nodeSlug,
          });
        }
      }
      console.log(`   ✓ ${methSlug}: ${phases.length} fases`);
    }

    // ============================================================================
    // 6. TÉCNICAS SAT (NATO AltA Handbook 2017 — 12 técnicas)
    // ============================================================================
    console.log('🔬 Semeando técnicas SAT...');

    const satTechniques = [
      {
        name: 'Identificação de Premissas-Chave',
        description: 'Identifica sistematicamente as premissas que sustentam o raciocínio e avalia quais são críticas para a validade da análise.',
        instructions: `PROCESSO (4 etapas):
1. REVISAR O RACIOCÍNIO ATUAL: Documente a linha de argumentação ou hipótese principal da análise.
2. LISTAR TODAS AS PREMISSAS: Identifique todas as suposições — explícitas e implícitas — que devem ser verdadeiras para o raciocínio ser válido. Inclua premissas sobre o ambiente, atores, tendências e dados disponíveis.
3. IDENTIFICAR PREMISSAS-CHAVE: Para cada premissa, pergunte: "Esta premissa PRECISA ser verdadeira para o argumento ser válido?" Classifique como chave (sim) ou não-chave (não). A "premissa-linchpin" é aquela cuja falha invalida toda a análise.
4. AVALIAR VULNERABILIDADE: Para cada premissa-chave, avalie:
   - Grau de confiança (alta / média / baixa)
   - Em que circunstâncias poderia ser falsa?
   - Qual seria o impacto se fosse falsa?
   - Que informação ou evento sinalizaria que está sendo violada?

FORMATO DE SAÍDA:
| Premissa | Chave? | Confiança | Vulnerabilidade | Sinal de Violação |
Concluir com: "PREMISSA-LINCHPIN: [nome] — impacto se falsa: [descrição]"`,
      },
      {
        name: 'Advocacia do Diabo',
        description: 'Um analista assume o papel de crítico e constrói o melhor argumento possível contra a hipótese principal, expondo falhas no raciocínio.',
        instructions: `PROCESSO (5 etapas):
1. DOCUMENTAR A HIPÓTESE PRINCIPAL: Escreva claramente a conclusão ou tese predominante que será desafiada.
2. IDENTIFICAR PREMISSAS VULNERÁVEIS: Liste as suposições mais críticas que sustentam a hipótese principal. Selecione a mais susceptível a questionamento.
3. REVISAR EVIDÊNCIAS CONTRÁRIAS: Examine se há evidências ignoradas, subestimadas ou de qualidade questionável. Avalie se há lacunas no conhecimento ou possibilidade de engano.
4. CONSTRUIR O CASO CONTRÁRIO: Elabore o argumento mais forte possível contra a hipótese principal. Inclua: evidências que contradizem, lógica alternativa, hipóteses rivais, e perguntas que a análise principal não responde.
5. APRESENTAR RESULTADOS: Entregue o caso contrário de forma construtiva. O objetivo é fortalecer a análise, não vencê-la.

FORMATO DE SAÍDA:
**HIPÓTESE PRINCIPAL:** [texto]
**CASO CONTRÁRIO (Advocacia do Diabo):**
- Evidências que contradizem: [...]
- Lacunas identificadas: [...]
- Hipótese rival: [...]
- Perguntas sem resposta: [...]
**VEREDICTO:** A hipótese principal [é reforçada / requer revisão / deve ser abandonada] porque [...]`,
      },
      {
        name: 'Análise Pré-Mortem',
        description: 'Simula mentalmente o fracasso de um plano ou análise e trabalha retrospectivamente para identificar as causas, revelando riscos antes que ocorram.',
        instructions: `PROCESSO (5 etapas):
1. FAMILIARIZAR COM O PLANO/ANÁLISE: Descreva o plano, decisão ou análise sendo testada.
2. CONFIGURAR O CENÁRIO DE FRACASSO: "Imagine que este plano foi implementado e fracassou completamente. É um desastre. O que aconteceu?"
3. GERAR CAUSAS DE FRACASSO (brainstorming): Liste todas as razões plausíveis pelo fracasso. Inclua: premissas que falharam, eventos externos adversos, erros de implementação, recursos insuficientes, fatores políticos, reações de atores contrários. Não filtre — capte tudo.
4. PRIORIZAR E CRUZAR COM O PLANO: Identifique os riscos mais críticos e verifique se o plano os mitiga. Para cada risco crítico sem mitigação: proponha ajuste ao plano.
5. REVISÃO PERIÓDICA: Estabeleça pontos de revisão futuros.

FORMATO DE SAÍDA:
**CENÁRIO ANALISADO:** [descrição]
**PRINCIPAIS CAUSAS DE FRACASSO IDENTIFICADAS:**
| # | Causa | Probabilidade | Impacto | Mitigação Existente? | Ação Recomendada |
**REFINAMENTOS PROPOSTOS AO PLANO:** [lista]`,
      },
      {
        name: 'Análise E-Se',
        description: 'Assume que um evento (positivo ou negativo) já ocorreu e explora como poderia ter acontecido, identificando gatilhos e indicadores de alerta.',
        instructions: `PROCESSO (6 etapas):
1. DEFINIR O EVENTO: Descreva com precisão o cenário hipotético a analisar. Especifique o estado do mundo se o evento ocorresse.
2. IDENTIFICAR GATILHOS: Use brainstorming para listar todos os incidentes que poderiam ter levado ao evento por uma cadeia causal.
3. MAPEAR TRAJETÓRIAS PLAUSÍVEIS: Identifique 2-3 caminhos plausíveis até o evento. Conecte gatilhos em sequência lógica. Trabalhe retroativamente a partir do evento.
4. DESENVOLVER ARGUMENTOS: Para cada trajetória, construa um raciocínio baseado em fatos, lógica e evidências disponíveis. Avalie consequências positivas e negativas de cada caminho.
5. GERAR INDICADORES: Liste sinais observáveis que sinalizariam o início ou evolução do evento em cada trajetória.
6. MONITORAR: Estabeleça como acompanhar esses indicadores.

FORMATO DE SAÍDA:
**EVENTO HIPOTÉTICO:** [descrição]
**TRAJETÓRIAS PLAUSÍVEIS:**
Trajetória A: [gatilho1] → [gatilho2] → [evento]
Trajetória B: [...]
**INDICADORES DE ALERTA ANTECIPADO:** [lista por trajetória]`,
      },
      {
        name: 'Análise SWOT',
        description: 'Avalia forças, fraquezas, oportunidades e ameaças de um projeto, decisão ou estratégia, revelando prioridades e ações.',
        instructions: `PROCESSO (3 fases, 5 etapas):
FASE A — IDENTIFICAR FATORES:
1. Para o tema em análise, identifique:
   - FORÇAS (internas, favoráveis): o que dá vantagem
   - FRAQUEZAS (internas, desfavoráveis): o que coloca em desvantagem
   - OPORTUNIDADES (externas, favoráveis): fatores a explorar
   - AMEAÇAS (externas, desfavoráveis): fatores a monitorar
2. PRIORIZAR: Ordene cada quadrante por importância. Use matriz de probabilidade × impacto para O e A.

FASE B — ESTRATÉGIA:
3. MATRIZ DE CONFRONTAÇÃO: Cruzar S/W com O/A:
   - S + O = Estratégia ofensiva (explorar)
   - S + A = Estratégia defensiva (mitigar com força)
   - W + O = Estratégia de desenvolvimento (converter fraqueza)
   - W + A = Estratégia de sobrevivência (prioridade máxima)
4. DESENVOLVER AÇÕES: Proponha 2-3 ações por quadrante de confrontação.

FASE C:
5. MONITORAR: Defina métricas de acompanhamento.

FORMATO DE SAÍDA:
Tabela SWOT 2×2 → Matriz de confrontação → Plano de ação por quadrante`,
      },
      {
        name: 'Cinco Porquês',
        description: 'Identifica a causa-raiz de um problema perguntando "por quê?" cinco vezes, quebrando sintomas superficiais até chegar à origem real.',
        instructions: `PROCESSO (4 etapas):
1. DEFINIR O PROBLEMA: Seja específico. Escreva o enunciado do problema com clareza.
2. IDENTIFICAR CAUSAS IMEDIATAS: Liste os motivos diretos e imediatos que causam o problema.
3. PERGUNTAR "POR QUÊ?" REPETIDAMENTE: Para cada causa imediata, pergunte "Por que isso é um problema?" ou "Por que isso acontece?". Repita 5 vezes (ou até chegar à causa-raiz). Em problemas multifacetados, cada causa inicial gera uma cadeia separada.
4. IDENTIFICAR SOLUÇÕES: As soluções devem atacar as causas-raiz identificadas, não apenas os sintomas.

DICAS:
- O número 5 é simbólico; use quantos forem necessários (4, 6, 8).
- Varie as perguntas: "Por que isso é importante?", "Por que não estamos corrigindo?"
- Problemas organizacionais geralmente têm múltiplas cadeias causais.

FORMATO DE SAÍDA:
**PROBLEMA:** [enunciado]
Cadeia 1: Causa → Por quê? → ... → CAUSA-RAIZ
Cadeia 2: ...
**SOLUÇÕES RECOMENDADAS:** [atacando causas-raiz]`,
      },
      {
        name: 'Adversário Substituto',
        description: 'Modela o comportamento de atores externos (adversários, competidores, neutros) replicando como pensariam sobre a situação, evitando espelhamento cultural.',
        instructions: `PROCESSO (4 etapas):
1. IDENTIFICAR O ATOR EXTERNO: Defina claramente quem é o ator a ser modelado (país, organização, líder, grupo). Identifique especialistas com conhecimento profundo desse ator.
2. RECRIAR A PERSPECTIVA DO ATOR: Imagine-se dentro da cultura, história, valores e pressões do ator. Abandone sua própria perspectiva. Considere:
   - Histórico, traumas, vitórias e narrativas do ator
   - Pressões internas (facções, burocracia, opiniões públicas)
   - Percepções sobre ameaças e oportunidades
   - Sistema de valores e tomada de decisão
3. DESENVOLVER PERGUNTAS EM PRIMEIRA PESSOA:
   - "O que meus pares, família ou aliados esperam que eu faça?"
   - "Como percebo as ameaças e oportunidades externas?"
   - "Que informações recebo e como as interpreto?"
   - "Quais são minhas preocupações pessoais ou institucionais?"
4. ANALISAR RESPOSTAS E PRODUZIR RECOMENDAÇÕES: Baseado nas respostas, que decisões, movimentos ou reações são mais prováveis desse ator?

FORMATO DE SAÍDA:
**ATOR MODELADO:** [nome]
**PERFIL CULTURAL E SITUACIONAL:** [síntese]
**PERGUNTAS E RESPOSTAS EM PRIMEIRA PESSOA:** [tabela]
**COMPORTAMENTOS MAIS PROVÁVEIS:** [lista priorizada]
**ALERTA DE ESPELHAMENTO CULTURAL:** [diferenças críticas entre a perspectiva do ator e a nossa]`,
      },
      {
        name: 'Futuros Alternativos',
        description: 'Explora sistematicamente múltiplas formas em que uma situação complexa e incerta pode se desenvolver, sem tentar predizer o futuro, mas criando contextos para reflexão estratégica.',
        instructions: `PROCESSO (6 etapas):
1. DEFINIR A QUESTÃO FOCAL: Estabeleça com precisão o problema ou tema de alta incerteza a explorar.
2. IDENTIFICAR FORÇAS E FATORES: Liste os fatores mais críticos que podem afetar o desfecho (use PESTEL ou PMESII como guia).
3. SELECIONAR EIXOS: Escolha por consenso os 2 fatores de maior impacto E maior incerteza. Defina os extremos (alto/baixo, favorável/desfavorável) de cada eixo.
4. CONSTRUIR A MATRIZ 2×2: Os 4 quadrantes representam 4 futuros alternativos. Nomeie cada quadrante.
5. DESENVOLVER NARRATIVAS: Para cada quadrante, construa uma narrativa plausível:
   - Como chegamos a este futuro? (trajetória causal)
   - Qual é o estado do mundo neste cenário?
   - Quem ganha e quem perde?
   - Que decisões da organização funcionam ou falham neste futuro?
   Inclua sinalizadores (indicadores observáveis) para detectar aproximação de cada futuro.
6. AVALIAR: Que decisões ou estratégias funcionam em TODOS os futuros? Quais são apostas em apenas um?

FORMATO DE SAÍDA:
**QUESTÃO FOCAL:** [texto]
**EIXOS:** Eixo X = [fator], Eixo Y = [fator]
**MATRIZ 2×2:**
Q1 (alto X, alto Y): [nome] — [narrativa 100-200 palavras]
Q2 (alto X, baixo Y): [nome] — [narrativa]
Q3 (baixo X, alto Y): [nome] — [narrativa]
Q4 (baixo X, baixo Y): [nome] — [narrativa]
**SINALIZADORES POR QUADRANTE:** [tabela]
**ESTRATÉGIAS ROBUSTAS (funcionam em todos):** [lista]`,
      },
      {
        name: 'Pensamento de Fora para Dentro',
        description: 'Aborda um problema da perspectiva externa, mapeando forças externas que moldam a situação em vez de focar apenas no que o ator controla internamente.',
        instructions: `PROCESSO (4 etapas):
1. DEFINIR O TEMA: Descreva o problema ou projeto de forma ampla.
2. LISTAR FORÇAS EXTERNAS: Identifique todos os fatores externos que podem afetar o tema — sobre os quais há pouco ou nenhum controle direto. Use frameworks como PESTEL (Político, Econômico, Social, Tecnológico, Ambiental, Legal) ou PMESII (Político, Militar, Econômico, Social, Infraestrutura, Informação).
3. MAPEAR FATORES INFLUENCIÁVEIS: Entre os externos, quais podem ser influenciados indiretamente? Por quem? Como?
4. AVALIAR IMPACTO: Para cada fator externo relevante: como afeta o tema? Em que prazo? Com que magnitude?

NOTA CRÍTICA: Evite o pensamento de dentro para fora (focar no que você controla). O valor desta técnica está em revelar forças externas que normalmente são ignoradas.

FORMATO DE SAÍDA:
**TEMA:** [descrição]
**MAPEAMENTO POR DOMÍNIO (PESTEL/PMESII):**
| Domínio | Fator Externo | Influenciável? | Impacto | Prazo |
**FATORES-CHAVE A MONITORAR:** [top 5 externos de maior impacto]`,
      },
      {
        name: 'Verificação de Qualidade da Informação',
        description: 'Avalia a completude, precisão, credibilidade e confiabilidade das fontes de informação utilizadas na análise.',
        instructions: `PROCESSO (4 etapas):
1. INVENTARIAR FONTES: Liste todas as fontes utilizadas na análise (documentos, fontes humanas, dados quantitativos, buscas na web).
2. APLICAR CHECKLIST POR FONTE: Para cada fonte, avalie:
   - ATRIBUIÇÃO: A origem é clara e identificável?
   - CREDENCIAIS: A fonte tem expertise reconhecida no assunto?
   - OBJETIVIDADE: Há conflito de interesse? A missão está clara?
   - QUALIDADE: A informação está bem estruturada, com métodos documentados?
   - ATUALIDADE: Quando foi publicada? Ainda é válida?
   - VERIFICABILIDADE: Outras fontes independentes chegaram a conclusões similares?
3. GRAU DE CONFIANÇA: Atribua para cada fonte: ALTA (atende todos os critérios), MÉDIA (atende a maioria), BAIXA (falha em critérios críticos), INDETERMINADA (não foi possível avaliar).
4. LACUNAS CRÍTICAS: Identifique informações-chave ausentes e novas necessidades de coleta.

FORMATO DE SAÍDA:
| Fonte | Tipo | Atribuição | Objetividade | Qualidade | Atualidade | Confiança |
**LACUNAS CRÍTICAS DE INFORMAÇÃO:** [lista]
**NÍVEL GERAL DE CONFIANÇA DA BASE DE FONTES:** [síntese]`,
      },
      {
        name: 'PMI — Prós, Contras e Pontos Interessantes',
        description: 'Técnica rápida que avalia os aspectos positivos, negativos e interessantes de uma decisão ou opção, facilitando uma análise equilibrada.',
        instructions: `PROCESSO (3 etapas):
1. DEFINIR O OBJETO: Especifique a decisão, opção, proposta ou declaração a analisar.
2. PREENCHER AS TRÊS COLUNAS:
   - PRÓS (Plusses): Por que gosto disso? Quais são os benefícios? O que dá certo?
   - CONTRAS (Minuses): Por que não gosto? Quais são os problemas potenciais? O que pode dar errado?
   - INTERESSANTES (Interesting): O que isso revela? Quais são as implicações futuras? O que é surpreendente ou digno de nota independentemente de ser bom ou ruim?
3. PONTUAR (opcional): Use escala +1 a +5 para Prós e Interessantes; -1 a -5 para Contras. Some os pontos para orientar a decisão.

FORMATO DE SAÍDA:
**OBJETO DA ANÁLISE:** [descrição]
| Prós (+) | Contras (-) | Interessantes |
**PONTUAÇÃO TOTAL:** Prós [X] + Contras [Y] + Interessantes [Z] = [resultado]
**RECOMENDAÇÃO:** [com base na análise PMI]`,
      },
      {
        name: 'Time A / Time B',
        description: 'Dois grupos debatem hipóteses ou posições opostas diante de um júri neutro, expondo os pontos fortes e fracos de cada argumento para apoiar decisões complexas.',
        instructions: `PROCESSO (2 fases, 8 etapas):
FASE A — PREPARAR POSIÇÕES:
1. IDENTIFICAR HIPÓTESES: Defina claramente 2 posições ou hipóteses concorrentes sobre o tema.
2. FORMAR OS TIMES: Cada time defende uma hipótese. Idealmente, atribua pessoas a times cujas posições NÃO são as suas naturais.
3. REVISAR EVIDÊNCIAS: Cada time avalia todos os dados relevantes que sustentam sua posição e identifica lacunas.
4. ESTRUTURAR ARGUMENTOS: Cada time elabora: premissas explícitas, evidências de suporte, lógica do argumento.

FASE B — DEBATER:
5. FORMAR JÚRI: Grupo neutro e independente que não participou da preparação.
6. APRESENTAÇÕES: Cada time apresenta sua posição (tempo igual para ambos). O júri faz perguntas.
7. DEBATE: Cada time contesta os argumentos do outro e defende sua posição.
8. VEREDICTO DO JÚRI: O júri avalia os méritos e recomenda próximos passos.

FORMATO DE SAÍDA:
**HIPÓTESE A:** [texto] | **HIPÓTESE B:** [texto]
**ARGUMENTOS TIME A:** [premissas, evidências, lógica]
**ARGUMENTOS TIME B:** [premissas, evidências, lógica]
**PONTOS DE CONCORDÂNCIA:** [onde convergem]
**PONTOS DE DIVERGÊNCIA:** [onde divergem]
**VEREDICTO DO JÚRI:** [hipótese mais sustentada + justificativa + lacunas a investigar]`,
      },
    ];

    for (const t of satTechniques) {
      await db.insert(techniques).values(t).onConflictDoUpdate({
        target: techniques.name,
        set: { description: t.description, instructions: t.instructions },
      });
    }
    console.log(`   ✓ ${satTechniques.length} técnicas SAT processadas`);

    // ============================================================================
    // 7. AGENT METHOD PROMPTS (Sprint 2 — extra_instructions por metodologia)
    // ============================================================================
    console.log('🧠 Semeando agent_method_prompts...');

    // Helpers — busca por nome (já seedados acima)
    const getAgent = async (name: string) => {
      const a = await db.query.agents.findFirst({ where: eq(agents.name, name) });
      if (!a) throw new Error(`Agent not found: ${name}`);
      return a;
    };
    const getMethod = async (slug: string) => {
      const m = await db.query.methodologies.findFirst({ where: eq(methodologies.slug, slug) });
      if (!m) throw new Error(`Methodology not found: ${slug}`);
      return m;
    };
    const upsertPrompt = async (agentName: string, methodSlug: string, extra: string) => {
      const agent = await getAgent(agentName);
      const method = await getMethod(methodSlug);
      await db.insert(agentMethodPrompts)
        .values({ agentId: agent.id, methodologyId: method.id, extraInstructions: extra.trim() })
        .onConflictDoUpdate({
          target: [agentMethodPrompts.agentId, agentMethodPrompts.methodologyId],
          set: { extraInstructions: extra.trim() },
        });
    };

    // ── HERMES ──────────────────────────────────────────────────────────────────
    await upsertPrompt('HERMES', 'godet', `
[METODOLOGIA GODET — ORQUESTRAÇÃO — 5 FASES]
Referência: La Prospective Stratégique de Michel Godet (LIPSOR/CNAM).
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, THEMIS, ATHENA.

Fase 1 · DELIMITAÇÃO DO SISTEMA (SCOPUS): Identificar componentes internos e variáveis externas do sistema. Produzir lista de variáveis para análise MICMAC.
Fase 2 · MICMAC — VARIÁVEIS-CHAVE (KLIO): Construir Matriz de Impactos Cruzados. Classificar variáveis: motrizes, alvo, reguladoras, autônomas.
Fase 3 · MACTOR — ANÁLISE DE ATORES (KLIO): Mapear atores, objetivos, meios de ação, alianças e conflitos.
Fase 4 · MORFOLOGIA + SMIC (PYTHIA): Construir espaço morfológico + hipóteses por variável-chave. Selecionar cenários coerentes e atribuir probabilidades (SMIC).
Fase 5 · OPÇÕES ESTRATÉGICAS E RAPPORT FINAL (HERMES): HERMES produz o RAPPORT PROSPECTIF GODET CONSOLIDADO diretamente — relendo o histórico.

Estrutura do RAPPORT FINAL GODET:
1. Enquadramento Estratégico | 2. Variáveis-Chave (MICMAC) | 3. Jogo de Atores (MACTOR) | 4. Morfologia dos Futuros | 5. Cenários (referência + contrastados) | 6. Opções Estratégicas | 7. Conclusão e Prioridades

Antes do rapport final, acione ATHENA.`);

    await upsertPrompt('HERMES', 'alta', `
[METODOLOGIA OTAN/AltA — ORQUESTRAÇÃO — 4 FASES]
Referência: NATO Alternative Analysis Handbook 2017.
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, THEMIS, ATHENA.

Fase 1 · INICIAÇÃO (HERMES): Definir o problema analítico com precisão. Selecionar as técnicas SAT adequadas em conjunto com SCOPUS. Apresentar o plano de análise alternativa ao usuário.
Fase 2 · PREPARAÇÃO (SCOPUS): Identificar premissas-chave, vieses cognitivos e recomendar técnicas SAT adequadas ao problema.
Fase 3 · APLICAÇÃO DAS TÉCNICAS (PYTHIA + THEMIS): Executar as análises alternativas selecionadas (Advocacia do Diabo, Futuros Alternativos, Análise Pré-Mortem, Identificação de Premissas-Chave, etc.).
Fase 4 · ENCERRAMENTO E PRODUTO ALTA FINAL (HERMES): Síntese das hipóteses alternativas, premissas revisadas e implicações para a análise principal.

Antes do produto final, acione ATHENA.
Produto final: PRODUTO ALTA FINAL consolidando hipóteses alternativas, premissas revisadas e implicações.`);

    await upsertPrompt('HERMES', 'msef', `
[METODOLOGIA MSEF — ORQUESTRAÇÃO — 7 ETAPAS]
Etapa 1 · ESCOPO (SCOPUS): Ficha de Escopo completa — tema, horizonte, questão estratégica central, atores, fronteiras, premissas.
Etapa 2 · AMBIENTE EXTERNO (KLIO): Análise PESTEL + drivers estratégicos com fontes reais. Matriz de impacto × incerteza.
Etapa 3 · INCERTEZAS CRÍTICAS (PYTHIA): Mapeamento e classificação das incertezas. Seleção dos 2 eixos de maior impacto e incerteza.
Etapa 4 · CONSTRUÇÃO DE CENÁRIOS (PYTHIA): Matriz 2×2. Nomeação e lógica dos 4 cenários (Q1-Q4).
Etapa 5 · NARRATIVAS (MNEMOSYNE): Narrativa completa de cada cenário — logline, trajetória causal, estado do mundo, sinais antecipados.
Etapa 6 · IMPLICAÇÕES E ALERTAS (THEMIS): Implicações por cenário e dimensão. Indicadores de alerta precoce com limiares observáveis.
Etapa 7 · MONITORAMENTO (KRATOS): Ciclo de monitoramento contínuo com dados oficiais atualizados.

[MAPEAMENTO DE ESPECIALISTAS]
- Escopo, premissas, ficha do projeto → SCOPUS
- Drivers, tendências, dados macro, PESTEL → KLIO
- Incertezas, eixos, matriz 2×2, cenários → PYTHIA
- Narrativas, loglines, histórias dos cenários → MNEMOSYNE
- Implicações estratégicas, alertas precoces → THEMIS
- Monitoramento contínuo, indicadores → KRATOS
- Revisão de qualidade analítica por fase → ATHENA

[RELATÓRIO FINAL PADRÃO MSEF]
Ao encerrar todas as 7 etapas, HERMES produz o "RELATÓRIO FINAL PADRÃO" DIRETAMENTE relendo o histórico:
1. Resumo Executivo | 2. Enquadramento Estratégico | 3. Contexto e Drivers | 4. Cenários Prospectivos (Q1-Q4) | 5. Narrativas | 6. Implicações e Alertas | 7. Recomendações Estratégicas.`);

    await upsertPrompt('HERMES', 'macroplan', `
[METODOLOGIA MACROPLAN — ORQUESTRAÇÃO]
Agentes disponíveis: KLIO, PYTHIA, THEMIS, ATHENA.

Fase 1 · MACROTENDÊNCIAS (KLIO): Identificar os principais drivers e macro-tendências do ambiente. Análise quantitativa e qualitativa de forças estruturais.
Fase 2 · CENÁRIOS ESTRATÉGICOS (PYTHIA): Construir cenários alternativos a partir dos drivers identificados. Avaliar probabilidades e coerência interna.
Fase 3 · IMPLICAÇÕES ESTRATÉGICAS (THEMIS): Derivar implicações, riscos e oportunidades por cenário. Formular opções estratégicas e indicadores de acompanhamento.

Após a Fase 3, acione ATHENA antes do Relatório Final.
Produto final: RELATÓRIO MACROPLAN consolidando tendências, cenários e implicações estratégicas.`);

    await upsertPrompt('HERMES', 'mpo', `
[METODOLOGIA MPO — ORQUESTRAÇÃO (Planejamento por Objetivos)]
Agentes disponíveis: SCOPUS, KLIO, THEMIS, ATHENA.

Fase 1 · DIAGNÓSTICO SITUACIONAL (SCOPUS): Identificar problemas prioritários, oportunidades e restrições. Mapear stakeholders e suas demandas.
Fase 2 · ANÁLISE DE CONTEXTO (KLIO): Analisar o ambiente externo, tendências relevantes e fatores críticos que afetam os objetivos.
Fase 3 · OBJETIVOS E PLANO DE AÇÃO (THEMIS): Formular objetivos estratégicos SMART, metas mensuráveis, indicadores de resultado e plano de ação com responsáveis e prazos.

Após a Fase 3, acione ATHENA antes do Relatório Final.
Produto final: PLANO MPO consolidando diagnóstico, objetivos, metas e plano de ação.`);

    await upsertPrompt('HERMES', 'asplan', `
[METODOLOGIA ASPLAN — ORQUESTRAÇÃO (Análise Estratégica Situacional)]
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, THEMIS, ATHENA.

Fase 1 · ENQUADRAMENTO (SCOPUS): Delimitar o sistema em análise, identificar atores, fronteiras, questão estratégica central.
Fase 2 · ANÁLISE DO AMBIENTE (KLIO): Diagnosticar o ambiente estratégico — oportunidades, ameaças, tendências com dados quantitativos.
Fase 3 · CENÁRIOS DE AMEAÇAS E OPORTUNIDADES (PYTHIA): Construir cenários estratégicos alternativos para o horizonte de planejamento.
Fase 4 · INDICAÇÕES ESTRATÉGICAS (THEMIS): Derivar implicações por cenário e formular indicações estratégicas para o decisor.

Após a Fase 4, acione ATHENA antes do Relatório Final.
Produto final: PRODUTO ASPLAN consolidando enquadramento, análise, cenários e indicações.`);

    await upsertPrompt('HERMES', 'futures', `
[METODOLOGIA FUTURES THINKING — ORQUESTRAÇÃO — 6 FASES]
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS, ATHENA.
Referência: Futures Cone (Hancock & Bezold) + CLA (Causal Layered Analysis, Inayatullah).

Fase 1 · ENQUADRAMENTO E HORIZONTE (SCOPUS): Delimitar o tema, horizonte temporal e questão focal. Identificar atores relevantes e fronteiras do sistema.
Fase 2 · SINAIS E TENDÊNCIAS (KLIO): Identificar sinais fracos, wild cards, tendências emergentes e megatendências relevantes. Classificar por Futures Cone: Possível, Plausível, Provável, Preferível.
Fase 3 · FUTUROS ALTERNATIVOS (PYTHIA): Construir futuros alternativos cobrindo os 4 quadrantes do Futures Cone. Aplicar CLA para aprofundar as camadas: eventos → sistemas → visão de mundo → mitos/metáforas.
Fase 4 · NARRATIVAS DE FUTUROS (MNEMOSYNE): Escrever narrativas vívidas para cada futuro, integrando as camadas CLA.
Fase 5 · IMPLICAÇÕES E ALERTAS (THEMIS): Derivar implicações para a organização em cada futuro. Formular indicadores de monitoramento e alertas.

Após a Fase 5, acione ATHENA antes do Relatório Final.
Produto final: RELATÓRIO FUTURES consolidando enquadramento, sinais, futuros alternativos, narrativas CLA e implicações.`);

    // ── SCOPUS ──────────────────────────────────────────────────────────────────
    await upsertPrompt('SCOPUS', 'msef', `
[METODOLOGIA MSEF — ENQUADRAMENTO ESTRATÉGICO — ETAPA 1]
- Preencher a Ficha de Escopo completa (8 campos: tema, horizonte, elaborador, cliente, questão estratégica, mudança identificada, nível de análise, contexto)
- Aplicar análise STEEP ao tema: Social, Tecnológico, Econômico, Ecológico, Político
- Identificar os dois eixos de incerteza crítica para a Matriz 2x2 (alta incerteza + alto impacto)
- Listar os drivers de mudança com intensidade estimada (Alta/Média/Baixa)
- Produto: Ficha de Escopo + briefing STEEP + eixos propostos para validação pelo HERMES`);

    await upsertPrompt('SCOPUS', 'grumbach', `
[METODOLOGIA GRUMBACH/CEEEx — DIAGNÓSTICO ESTRATÉGICO — FASE 2]
- Identificar Fatos Portadores de Futuro (FPF): eventos em curso com potencial de impacto futuro significativo
- Formular Eventos como questões binárias (ocorre/não ocorre) com horizonte temporal definido
- Para cada evento: estimar probabilidade inicial de ocorrência (0-100%)
- Classificar eventos por grau de motricidade e dependência
- Produto: lista de FPF + tabela de eventos com probabilidades preliminares + mapa de motricidade/dependência`);

    await upsertPrompt('SCOPUS', 'godet', `
[METODOLOGIA GODET — DELIMITAÇÃO DO SISTEMA — FASE 1]
- Delimitar o sistema em análise: componentes internos e variáveis externas
- Listar todas as variáveis relevantes (internas e externas)
- Preparar lista de variáveis para análise MICMAC (matriz de impactos cruzados)
- Produto: lista estruturada de variáveis para análise de influências pelo KLIO`);

    await upsertPrompt('SCOPUS', 'alta', `
[METODOLOGIA AltA — FASE DE PREPARAÇÃO]
- Identificar as premissas-chave subjacentes à análise principal
- Mapear os vieses cognitivos potenciais na equipe analítica
- Selecionar as técnicas SAT mais adequadas ao problema (conforme instruções do HERMES)
- Produto: briefing de premissas + recomendação de técnicas SAT`);

    // ── KLIO ────────────────────────────────────────────────────────────────────
    await upsertPrompt('KLIO', 'msef', `
[METODOLOGIA MSEF — ANÁLISE AMBIENTAL — ETAPA 2]
- Produzir análise PESTEL completa com dados quantitativos para cada dimensão
- Construir Matriz de Impacto × Incerteza com os principais drivers
- Avaliar o impacto potencial de cada driver nos eixos de incerteza identificados pelo SCOPUS
- Produto: relatório PESTEL + Matriz Impacto×Incerteza + drivers ranqueados`);

    await upsertPrompt('KLIO', 'godet', `
[METODOLOGIA GODET — ANÁLISE MICMAC — FASE 2]
- Construir a Matriz de Impactos Cruzados Multiplicação Aplicada a uma Classificação (MICMAC)
- Para cada par de variáveis: avaliar influência direta (0=nula, 1=fraca, 2=moderada, 3=forte)
- Identificar variáveis motrizes (alta influência, baixa dependência) e variáveis-alvo (baixa influência, alta dependência)
- Produto: matriz MICMAC + classificação de variáveis por posicionamento estratégico`);

    await upsertPrompt('KLIO', 'siplex', `
[METODOLOGIA SIPLEx — ANÁLISE DO AMBIENTE ESTRATÉGICO — FASE 2]
- Analisar o ambiente estratégico nacional e internacional com horizonte de 20 anos
- Foco em defesa, segurança e fatores que impactam a missão institucional
- Aplicar metodologia CEEEx/Grumbach para construção de cenários prospectivos
- Identificar ameaças, oportunidades e tendências para subsidiar a PMT
- Produto: AAE estruturada conforme EB20-N-03.002 com cenários prospectivos`);

    // ── PYTHIA ──────────────────────────────────────────────────────────────────
    await upsertPrompt('PYTHIA', 'msef', `
[METODOLOGIA MSEF — CENÁRIOS PROSPECTIVOS — ETAPAS 3 e 4]
Etapa 3 — Eixos de Incerteza:
- Com base na análise do KLIO, confirmar os dois eixos de incerteza crítica
- Construir a Matriz 2x2: eixo horizontal × eixo vertical
- Nomear os 4 quadrantes (Q1, Q2, Q3, Q4) com títulos evocativos

Etapa 4 — Cenários:
- Para cada quadrante: premissas, descrição do mundo em t+horizonte, probabilidade
- Probabilidades somam 100%
- 3-5 indicadores-sentinela por cenário
- Produto: Matriz 2x2 completa + ficha de cada cenário`);

    await upsertPrompt('PYTHIA', 'grumbach', `
[METODOLOGIA GRUMBACH/CEEEx — ELABORAÇÃO DE CENÁRIOS — FASE 3]
- Cenário Mais Provável: baseado nas probabilidades dos eventos (método Delphi + Impactos Cruzados)
- Cenário Ideal: todos os eventos favoráveis ocorrem, nenhum desfavorável
- Cenário Alvo: entre Mais Provável e Ideal — desejável e exequível
- Cenário de Tendência: evolução da conjuntura atual sem rupturas
- Narrativa em primeira pessoa do horizonte temporal: "Estamos em [ano]..."
- Produto: 4 cenários com narrativas de 300-500 palavras cada`);

    await upsertPrompt('PYTHIA', 'godet', `
[METODOLOGIA GODET — MORFOLOGIA — FASE 4]
- Construir o espaço morfológico: hipóteses alternativas (2-4) para cada variável-chave
- Selecionar combinações coerentes de hipóteses para formar cenários
- Verificar coerência interna de cada combinação
- Nomear cada cenário com título evocativo
- Avaliar probabilidade relativa usando SMIC (Sistema e Matrizes de Impactos Cruzados)
- Produto: matriz morfológica + fichas de cenários com combinações de hipóteses`);

    // ── MNEMOSYNE ───────────────────────────────────────────────────────────────
    await upsertPrompt('MNEMOSYNE', 'msef', `
[METODOLOGIA MSEF — NARRATIVAS DE CENÁRIOS — ETAPA 5]
- Escrever narrativa para cada um dos 4 quadrantes (Q1-Q4) da Matriz 2x2
- Abertura: "É [ano]. O mundo que emergiu foi..."
- 7 componentes obrigatórios: logline, trajetória, contexto global, contexto nacional, wild cards, implicações para o cliente, indicadores de chegada
- Mínimo 400 palavras por narrativa
- Produto: 4 narrativas completas com os 7 componentes`);

    await upsertPrompt('MNEMOSYNE', 'grumbach', `
[METODOLOGIA GRUMBACH/CEEEx — NARRATIVAS DE CENÁRIOS — FASE 3]
- Redigir narrativa para cada um dos 4 cenários CEEEx (Mais Provável, Ideal, Alvo, Tendência)
- Abertura obrigatória: "Estamos em [ano]..."
- Narrativa em primeira pessoa do horizonte temporal — o futuro como presente vivido
- 300-500 palavras por narrativa
- Consistência interna: cada narrativa deve ser coerente com as probabilidades dos eventos
- Produto: 4 narrativas para os cenários GRUMBACH`);

    // ── THEMIS ──────────────────────────────────────────────────────────────────
    await upsertPrompt('THEMIS', 'msef', `
[METODOLOGIA MSEF — IMPLICAÇÕES E ALERTAS — ETAPA 6]
- Para cada quadrante: 3-5 implicações estratégicas (hedges e bets)
- Tabela de alertas precoces: sinal observável → cenário que indica
- Identificar o cenário de maior risco e o de maior oportunidade
- Produto: matriz de implicações por quadrante + tabela de alertas com indicadores-sentinela`);

    await upsertPrompt('THEMIS', 'grumbach', `
[METODOLOGIA GRUMBACH/CEEEx — INDICAÇÕES ESTRATÉGICAS — FASE 4]
- Para cada evento do Cenário Alvo: oportunidades e ameaças decorrentes
- Indicações estratégicas rastreáveis ao evento que as origina
- Formato: Evento → Ocorre/Não Ocorre → Oportunidades → Ameaças → Indicações
- Produto: tabela estruturada evento × oportunidades/ameaças × indicações`);

    await upsertPrompt('THEMIS', 'godet', `
[METODOLOGIA GODET — ESTRATÉGIAS — FASE 5]
- Para cada cenário morfológico: estratégias e opções para a organização
- Avaliar a posição de cada ator principal em cada cenário
- Identificar margens de manobra e campos de batalha estratégicos
- Produto: matriz estratégias × cenários + análise de atores por cenário`);

    // ── OLYMPUS ─────────────────────────────────────────────────────────────────
    await upsertPrompt('OLYMPUS', 'grumbach', `
[METODOLOGIA GRUMBACH - PLANEJAMENTO — ORQUESTRAÇÃO — 5 FASES]
Referência: Método CEEEx/EB (Centro de Estudos Estratégicos do Exército).
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, MNEMOSYNE, THEMIS, KRATOS, ATHENA.

Fase 1 · PLANEJAMENTO INICIAL (OLYMPUS): Definir sistema em análise, horizonte temporal e delimitação. Identificar os Fatos Portadores de Futuro (FPF) iniciais com o usuário.
Fase 2 · DIAGNÓSTICO ESTRATÉGICO (SCOPUS): Formular eventos binários (ocorre/não ocorre) com probabilidades + mapa de atores influentes.
Fase 3 · ELABORAÇÃO DE CENÁRIOS — Delphi + Impactos Cruzados (PYTHIA + MNEMOSYNE): 4 cenários CEEEx (Mais Provável, Ideal, Alvo, Tendência) com narrativas "Estamos em [ano]...".
Fase 4 · INDICAÇÕES ESTRATÉGICAS (THEMIS): Tabela evento × oportunidades/ameaças × indicações estratégicas rastreáveis.
Fase 5 · DIVULGAÇÃO E MONITORAMENTO (KRATOS): Quadro de Monitoramento de Eventos (QME) + indicadores de acompanhamento por evento.

Antes do RELATÓRIO GRUMBACH, acione ATHENA.

Produto final — RELATÓRIO GRUMBACH — estruturado em:
1. Planejamento (sistema, horizonte, delimitação) | 2. Diagnóstico (FPF + eventos + atores) | 3. Cenários (4 tipos + narrativas) | 4. Indicações estratégicas | 5. QME e monitoramento`);

    await upsertPrompt('OLYMPUS', 'siex', `
[METODOLOGIA SIEX - MPC — ORQUESTRAÇÃO — 5 FASES]
Referência: EB70-MT-10.401 (Metodologia de Produção do Conhecimento de Inteligência do SIEx, COTER, 1ª Ed. 2019).
Agentes disponíveis: SCOPUS, KLIO, PYTHIA, THEMIS, ATHENA.

Fase 1 · PLANEJAMENTO (SCOPUS): Ficha de Planejamento — Assunto, Faixa de Tempo, Usuário, Finalidade, Prazo, AEC/AECK, Medidas de Segurança.
Fase 2 · REUNIÃO (KLIO): Coleta e busca por cada AECK com avaliação TAD (fonte A-E, conteúdo 1-6).
Fase 3 · ANÁLISE E SÍNTESE (KLIO + PYTHIA): Pertinência, credibilidade, frações significativas e integração.
Fase 4 · INTERPRETAÇÃO (PYTHIA): Fatores de influência + trajetória + hipóteses hierarquizadas por probabilidade.
Fase 5 · FORMALIZAÇÃO E DIFUSÃO (THEMIS): Implicações por hipótese + indicadores de alerta precoce + recomendações + Estimativa (§5.8).

DIFERENÇA CRÍTICA: as fases SIEx NÃO têm limites precisos e interpenetram-se — sinalize isso ao usuário ao iniciar.
Antes do RELATÓRIO SIEx CONSOLIDADO, acione ATHENA.

Produto final: RELATÓRIO SIEx CONSOLIDADO consolidando as 5 fases.`);

    console.log('   ✓ agent_method_prompts inseridos/atualizados');

    console.log('✅ Seed concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    process.exit(1);
  }
}

runSeed();
