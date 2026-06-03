# OLYMPUS 1.0 — UI/UX Design Specification
**Principal Product Designer — Palantir**  
**Data:** 02 Jun 2026 | **Versão:** 1.0 | **Status:** Working Draft — para implementação futura

---

## FILOSOFIA DE DESIGN

O OLYMPUS não é um chatbot. É uma **pipeline analítica com portões de decisão humana**.

Cada decisão de design deriva de três princípios:

1. **Rastreabilidade total** — toda conclusão deve ser clicável até a fonte primária. O analista defende o relatório perante um conselho; o produto defende o analista.
2. **Pipeline visibility** — o analista sabe exatamente em que fase está, o que KLIO fez, o que ATHENA verificou. Nenhuma "caixa preta".
3. **Densidade sem caos** — dados densos apresentados com hierarquia precisa. Nenhum pixel decorativo; cada elemento tem função.

> "We build software that thinks like an expert, so that experts can think faster." — Palantir design principle

---

## PARTE 1 — INFORMATION ARCHITECTURE

### 1.1 Hierarquia de informação

```
OLYMPUS
│
├── WORKSPACE (nível projeto)
│   ├── Projeto ─── Pipeline de fases
│   │                ├── Fase ──── Artefatos estruturados (phase_output)
│   │                │             ├── KeyFindings [{claim, factStatus, tadScore}]
│   │                │             ├── Veredicto ATHENA
│   │                │             └── Eventos registrados (project_events)
│   │                ├── Portão HITL ── Aprovação/rejeição de eventos
│   │                └── Relatório Final (message: relatorio_final)
│   │
│   ├── Eventos ─── Lista de FPFs/tendências/incertezas
│   │               ├── Proposed → Approved → Rejected
│   │               └── Avaliação TAD (sourceEvaluation A-F × 1-6)
│   │
│   ├── Cenários ── project_scenarios
│   │               ├── Configuração booleana (FPF → OCORRE/NÃO OCORRE)
│   │               └── Probabilidade P(i) e P(i|j)
│   │
│   ├── ATHENA ──── Veredictos por fase
│   │               ├── Checks determinísticos (ATS 1-9)
│   │               └── Cadeia de raciocínio
│   │
│   └── Lastro ──── Rastreabilidade completa
│                   Conclusão → Finding → Evento → Fonte → ATHENA
│
├── MONITORAMENTO (KRATOS)
│   ├── Dashboard de indicadores por projeto
│   ├── Alertas ativos (signposts disparados)
│   └── Painel do Cliente (JWT público, read-only)
│
├── CONFIGURAÇÃO
│   ├── Novo Projeto (metodologia, horizonte, cliente)
│   ├── Configurações LLM (provider, tiers)
│   └── Embeddings / RAG (upload de documentos)
│
└── ADMINISTRAÇÃO
    ├── Usuários + Equipes
    ├── Audit Log (hash-chain SHA-256)
    └── Backup / Exportação
```

### 1.2 Modelo mental do analista

O analista pensa em **ciclos de análise**, não em "conversas com IA":

| Etapa mental | Suporte do sistema |
|---|---|
| "Preciso analisar X" | Novo Projeto → selecionar metodologia → definir escopo |
| "Quero ver o progresso" | Pipeline de fases com status visual + veredictos ATHENA |
| "Preciso aprovar os dados" | Portão HITL → revisar eventos → aprovar/rejeitar |
| "Quero ver o que foi encontrado" | Painel de Lastro → rastrear até fonte |
| "Preciso do relatório" | Exportar DOCX/PDF com âncoras de rastreabilidade |
| "Quero monitorar no tempo" | Dashboard KRATOS → alertas proativos |

---

## PARTE 2 — SITEMAP

```
/                           → Redirect → /dashboard
│
├── /dashboard              → Dashboard Executivo (todos os projetos)
│
├── /projeto/novo           → Wizard de novo projeto
│
├── /projeto/:id            → Tela de Projeto
│   ├── /projeto/:id/pipeline       → Pipeline de fases (tela principal)
│   ├── /projeto/:id/eventos        → Lista HITL de eventos
│   ├── /projeto/:id/cenarios       → Cenários e configurações booleanas
│   ├── /projeto/:id/athena         → Tela ATHENA (auditoria por fase)
│   ├── /projeto/:id/lastro         → Tela de Lastro (rastreabilidade)
│   ├── /projeto/:id/relatorio      → Relatório final (render Markdown)
│   └── /projeto/:id/exportar       → Download DOCX / PDF / HTML
│
├── /monitoramento          → Dashboard KRATOS global
│   └── /monitoramento/:id  → Projeto específico (indicadores + alertas)
│
├── /painel/:token          → Painel do Cliente (JWT público, read-only)
│
└── /config
    ├── /config/llm         → Configuração de provider e tiers
    ├── /config/embeddings  → Upload de documentos (RAG)
    ├── /config/usuarios    → Gestão de usuários e equipes
    └── /config/audit       → Audit Log com verificação de hash-chain
```

---

## PARTE 3 — USER FLOWS

### Flow 1 — Nova análise Grumbach (primário)

```
[Dashboard] → "Nova Análise"
     ↓
[Wizard] → Selecionar metodologia: Grumbach
         → Nome do projeto, cliente, horizonte temporal
         → Modo: Etapa / Passos / Passagem
         → Conectividade: Online / Soberano / Air-Gapped
     ↓
[Tela de Projeto] → Pipeline inicia
     ↓
[Fase 1 — KLIO trabalhando]
   → Streaming de tokens visível no painel de atividade
   → Eventos aparecendo em tempo real no EventsPanel
   → Badge ATHENA: APROVADO / RESSALVAS / REQUER_REVISÃO
     ↓
[Fase 2 — KLIO continua]
     ↓
[Fase 3 — PORTÃO HITL]
   → Sistema pausa
   → Analista vê lista de FPFs propostos com scores TAD
   → Analista aprova/rejeita individualmente
   → Analista clica "Continuar"
     ↓
[Fases 4-9 — KLIO executa]
     ↓
[Síntese — HERMES compila relatório]
   → Token streaming visível
   → Relatório final renderizado em Markdown
     ↓
[Tela de Relatório] → Exportar / Compartilhar
```

### Flow 2 — Revisão de Lastro (auditoria)

```
[Relatório Final] → Clique em afirmação → "Ver Lastro"
     ↓
[Tela de Lastro] → Árvore de rastreabilidade
   → Conclusão → Finding (claim + factStatus + tadScore)
   → Finding → Evento (project_event com sourceEvaluation)
   → Evento → Fonte (URL / documento interno / dado público)
   → Fonte → ATHENA check que validou
     ↓
[Detalhes do evento] → TAD completo + fase em que foi registrado
```

### Flow 3 — Retomada após interrupção (HITL resume)

```
[Dashboard] → Projeto com badge "Aguardando aprovação"
     ↓
[Tela de Projeto] → Status: PAUSADO — Portão HITL ativo
     ↓
[EventsPanel] → Lista de eventos com status "proposed"
   → Filtro por tipo (FPF / tendência / incerteza)
   → Cada evento mostra: nome, descrição, TAD, fonte
     ↓
[Ação] → Aprovar todos / Aprovar selecionados / Rejeitar
     ↓
[Clique em "Continuar"] → Resume LangGraph checkpoint
     ↓
[Pipeline retoma da fase seguinte]
```

### Flow 4 — Monitoramento KRATOS

```
[Dashboard] → Badge vermelho "Alerta KRATOS"
     ↓
[Painel KRATOS] → Lista de alertas por projeto
   → Indicador → Valor atual vs. limiar → Signpost disparado
     ↓
[Detalhe] → Cenário que se está materializando
   → Ação recomendada
     ↓
[Opção] → Iniciar nova análise / Atualizar cenários
```

---

## PARTE 4 — DASHBOARD EXECUTIVO

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ OLYMPUS 1.0          [Gemini 2.5 Flash ▾]  [Admin ▾]  [⚙️]    │
├─────────────────────────────────────────────────────────────────┤
│ Dashboard                              [+ Nova Análise]         │
├──────────────────────────┬──────────────────────────────────────┤
│ PROJETOS ATIVOS          │ ALERTAS KRATOS                       │
│                          │                                       │
│  ● Projeto Alpha    🟢   │  🔴 Análise Brasil 2050             │
│    Grumbach · Fase 6/9   │     PIB > limiar → Cena A +20%      │
│    ATHENA: 5 APROVADO    │     há 2h                            │
│                          │                                       │
│  ⏸ Análise Defesa   🟡   │  🟡 Análise Defesa Nacional         │
│    CEEEx · AGUARDANDO    │     Orçamento defesa: monitorando    │
│    Portão HITL ativo     │                                       │
│                          │  ─────────────────────────────────   │
│  ✅ Cenário 2035    ✓    │  ÚLTIMAS ANÁLISES CONCLUÍDAS         │
│    Godet · Concluído     │                                       │
│    14 Mai 2026           │  📄 Análise Petróleo — 28 Mai       │
│                          │  📄 Cenário Climático — 22 Mai      │
│  [Ver todos...]          │  📄 SIEX Brasil — 15 Mai            │
├──────────────────────────┴──────────────────────────────────────┤
│ MÉTRICAS DO SISTEMA                                             │
│  Análises: 23     Fases executadas: 187     ATHENA: 94% ✅      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Card de Projeto

```
┌────────────────────────────────────────────────────┐
│ ● Análise Brasil 2050                         🟢  │
│   MPO · Horizonte 2050 · Modo: Etapa               │
│                                                    │
│   ████████████████░░░░░░  Fase 7/9                 │
│   HERMES compilando relatório...                   │
│                                                    │
│   ATHENA: ████ 6 APROVADO  ░ 1 RESSALVAS           │
│   FPFs aprovados: 12 / 15                         │
│                                                    │
│   [Abrir]  [Relatório]  [KRATOS]                  │
└────────────────────────────────────────────────────┘
```

### 4.3 Estados visuais de projeto

| Estado | Cor | Ícone | Descrição |
|---|---|---|---|
| Em execução | Verde (#2E7D52) | ● | KLIO ativo na fase atual |
| Aguardando HITL | Âmbar (#C9A84C) | ⏸ | Portão HITL — analista precisa aprovar |
| Concluído | Verde claro | ✅ | Relatório final disponível |
| Erro | Vermelho | ❌ | Falha na execução — ver logs |
| Alerta KRATOS | Vermelho | 🔴 | Signpost disparado |

---

## PARTE 5 — TELA DE PROJETO

### 5.1 Layout principal (modo Pipeline)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Dashboard   Análise Brasil 2050   [Grumbach]  [Fase 6/9]  🟢 │
├──────────────────────────┬──────────────────────────────────────┤
│ PIPELINE                 │ ATIVIDADE AO VIVO                    │
│                          │                                       │
│ ●─ F1 Delimitação ✅     │ [KLIO] Iniciando fase 6...           │
│ │  ATHENA: APROVADO      │ ─────────────────────────────────    │
│ ●─ F2 Varredura FPF ✅   │ tool_register_scenario chamada      │
│ │  ATHENA: APROVADO      │   name: "Cena A — Mais Provável"    │
│ ●─ F3 HITL ✅ (12 apr.) │   probability: 0.42                 │
│ │  ATHENA: APROVADO      │   fpfs: FPF-1[OCORRE], FPF-2[NÃO]  │
│ ●─ F4 Delphi P(i) ✅     │                                       │
│ │  ATHENA: RESSALVAS     │ tool_register_scenario chamada      │
│ ●─ F5 P(i|j) ✅          │   name: "Cena B — Projetivo"        │
│ │  ATHENA: APROVADO      │   ...                               │
│ ◎─ F6 Cenas (atual)      │                                       │
│ │  ████████░░ 80%        │ [KLIO] Fase 6 concluída             │
│ ○─ F7 Narrativas         │ [ATHENA] Auditando...               │
│ ○─ F8 Indicações         │ [ATHENA] ✅ APROVADO                │
│ ○─ F9 Monitoramento      │   ATS8: 4 cenas mapeadas ✓          │
│ ○─ HERMES (síntese)      │                                       │
│                          │ ─────────────────────────────────    │
│ [▶ Continuar]            │ Contexto: 268 tokens · 5 fases ant. │
└──────────────────────────┴──────────────────────────────────────┘
```

### 5.2 Portão HITL (estado de pausa)

```
┌─────────────────────────────────────────────────────────────────┐
│ ⏸ PORTÃO HITL — Fase 3: Seleção de FPFs                        │
│ O analista deve aprovar os FPFs antes de KLIO iniciar o Delphi  │
├─────────────────────────────────────────────────────────────────┤
│ [Aprovar todos]  [Exportar para revisão]  [Filtrar ▾]          │
├─────────────────────────────────────────────────────────────────┤
│ ☐  [FPF-01] Adoção massiva de IA em comando militar            │
│    fonte: RAND B2 · Tipo: incerteza · [FATO]                   │
│    "Adoção >60% até 2030 segundo projeção RAND (habitualmente  │
│     idônea / provavelmente verdadeira)"                         │
│    [✅ Aprovar]  [❌ Rejeitar]  [✏️ Editar]                     │
├────────────────────────────────────────────────────────────────┤
│ ☑  [FPF-02] Tensão OTAN leste europeu         ← Aprovado       │
│    fonte: Reuters A2 · Tipo: fpf · [FATO]                      │
├────────────────────────────────────────────────────────────────┤
│ ☐  [FPF-03] Fragmentação multilateralismo WTO                  │
│    fonte: FMI C3 · Tipo: tendência · [INDÍCIO]                 │
│    [✅ Aprovar]  [❌ Rejeitar]                                  │
├────────────────────────────────────────────────────────────────┤
│ 8/15 aprovados · 2 rejeitados · 5 pendentes                    │
│                                                                  │
│ [Continuar análise →]      (mín. 10 FPFs aprovados para Delphi) │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Painel de Eventos (sidebar direita)

```
┌─────────────────────────────────────────────────────┐
│ EVENTOS REGISTRADOS                    [Filtrar ▾]  │
├─────────────────────────────────────────────────────┤
│ [FPF] Adoção IA em comando             B2  ✅ apr.  │
│ [FPF] Tensão OTAN leste europeu        A2  ✅ apr.  │
│ [TND] Multipolaridade crescente        B3  ✅ apr.  │
│ [INC] Fragmentação WTO                 C3  ⏳ prop. │
│ [FPF] Crise demográfica Europa         A1  ✅ apr.  │
│                                                     │
│ Total: 15 · Aprovados: 12 · Propostos: 3           │
└─────────────────────────────────────────────────────┘
```

---

## PARTE 6 — TELA ATHENA

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ATHENA — Auditoria Analítica                 Análise Brasil 2050 │
├──────────────────────────┬──────────────────────────────────────┤
│ SUMÁRIO                  │ FASE 5 — Impacto Cruzado P(i|j)      │
│                          │ node_modeling · KLIO · 02 Jun 12:34  │
│ F1 Delimitação    ✅     │                                       │
│ F2 Varredura      ✅     │ VEREDICTO: ✅ APROVADO               │
│ F3 HITL           ✅     │ LLM usado: Não (determinístico)       │
│ F4 Delphi         ⚠️     │                                       │
│ F5 P(i|j)         ✅     │ CHECKS ESTRUTURAIS                    │
│ F6 Cenas          ✅     │                                       │
│ F7 Narrativas     ─      │ ATS2 ✅ Qualificador Hendrikson       │
│ F8 Indicações     ─      │       "provável (P=0.65)" detectado  │
│ F9 Monitoramento  ─      │                                       │
│                          │ ATS8 ✅ 8 hipóteses/incertezas        │
│ Score geral:             │       distintas formuladas            │
│ 5 APROVADO               │                                       │
│ 1 RESSALVAS              │ ELOS MAIS FRACOS (declarados por KLIO)│
│ 0 REQUER_REVISÃO         │ "FPF-7 (crise fiscal) depende de      │
│                          │  FPF-3 (WTO) com I=1.8 — moderado"  │
├──────────────────────────┤                                       │
│ FASE 4 — RESSALVAS ⚠️    │ KEY FINDINGS DESTA FASE               │
│                          │                                       │
│ ATS2 ⚠️ Qualificador     │ [FATO B2] FPF-1: P(i)=0.72 — muito  │
│  Hendrikson presente     │  provável · consenso 6/7 especialistas│
│  mas 2 FPFs sem          │                                       │
│  justificativa analítica │ [FATO A2] FPF-2: P(i)=0.85 — quase  │
│                          │  certo · consenso 7/7 especialistas  │
│ [Detalhar →]             │                                       │
└──────────────────────────┴──────────────────────────────────────┘
```

### 6.2 Detalhe de ATS check

```
┌─────────────────────────────────────────────────────────────────┐
│ ATS2 — Linguagem de Probabilidade Calibrada                     │
│ node_modeling · Fase 4 — Delphi P(i) · RESSALVAS               │
├─────────────────────────────────────────────────────────────────┤
│ STATUS: ⚠️ RESSALVAS                                            │
│                                                                  │
│ ✅ Qualificadores Hendrikson presentes: "provável", "possível"  │
│    detectados em 10/12 FPFs                                     │
│                                                                  │
│ ⚠️ 2 FPFs sem justificativa analítica acompanhando             │
│    o qualificador (regra ICD 203: "cada qualificador deve       │
│    vir acompanhado de justificativa analítica em 1-2 frases")  │
│                                                                  │
│ FPFs afetados:                                                  │
│   · FPF-9: "improvável" sem justificativa                       │
│   · FPF-11: "possível" sem justificativa                        │
│                                                                  │
│ Referência: ICD 203 (ODNI 2022) · Hendrikson Lexicon           │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 7 — TELA DE LASTRO

A tela de Lastro é o diferencial institucional do OLYMPUS: toda conclusão é rastreável até a fonte primária.

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ LASTRO ANALÍTICO                             Análise Brasil 2050 │
│ "Rastrear de conclusão até fonte"                               │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Pesquisar afirmação...                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ RELATÓRIO FINAL → CENA A                                        │
│ "O mais provável dos futuros: IA generalizada em gestão pública"│
│ [Ver no relatório]                                              │
│          ↓                                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ FINDING — Fase 6 (Seleção de Cenas)                      │   │
│ │ "Cena A [Mais Provável]: FPF-1[OCORRE], FPF-2[NÃO       │   │
│ │  OCORRE], FPF-3[OCORRE], FPF-7[OCORRE]..."              │   │
│ │ factStatus: FATO · ATHENA: ✅ APROVADO                   │   │
│ └──────────────────────────────────────────────────────────┘   │
│          ↓                                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ EVENTO — FPF-1: Adoção massiva IA em comando militar    │   │
│ │ type: fpf · status: approved                             │   │
│ │ sourceEvaluation: { reliability: "B", credibility: "2" } │   │
│ │ → Habitualmente idônea / Provavelmente verdadeira        │   │
│ └──────────────────────────────────────────────────────────┘   │
│          ↓                                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ FONTE PRIMÁRIA                                           │   │
│ │ RAND Corporation — "AI in Military Command & Control"    │   │
│ │ Fase de captura: F2 Varredura FPFs · 02 Jun 2026         │   │
│ │ tool_register_event chamada com mpc_source_evaluator     │   │
│ └──────────────────────────────────────────────────────────┘   │
│          ↓                                                      │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ ATHENA — Verificação F2 (node_scanning_macro)            │   │
│ │ ATS1: ✅ Score TAD presente (B2)                         │   │
│ │ Verificação determinística — sem LLM                     │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ [Exportar cadeia de lastro →]  [Copiar para revisão]           │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Navegação por árvore completa

```
Relatório Final
  └─ Seção 4: Cenas Selecionadas
       └─ "Cena A — Mais Provável" (F6, KLIO)
            ├─ FPF-1 [OCORRE] → Evento #uuid-3b7 → Fonte RAND B2 → ATHENA F2 ✅
            ├─ FPF-3 [OCORRE] → Evento #uuid-9c2 → Fonte IMF C3  → ATHENA F2 ✅
            └─ FPF-7 [OCORRE] → Evento #uuid-1a4 → Fonte BCB A1  → ATHENA F2 ✅
  └─ Seção 5: Indicações Estratégicas
       └─ "SE gastos P&D > 2,5% ENTÃO Cena C +20%" (F8, KLIO)
            └─ Signpost #sig-44f → baseado em FPF-3 → origem: Fase 5 P(i|j)
```

---

## PARTE 8 — DESIGN SYSTEM

### 8.1 Tokens de cor

```css
/* Paleta primária — verde soberano */
--color-primary-900: #0D2318;    /* Fundo sidebar, topos de tabela */
--color-primary-800: #1B3A2D;    /* Fundo elementos de destaque */
--color-primary-700: #2E5D45;    /* Hover em elementos primários */
--color-primary-600: #2E7D52;    /* Cor principal de ação */
--color-primary-400: #4CAF80;    /* Indicadores de sucesso */
--color-primary-100: #E8F5E9;    /* Fundo de seções destacadas */

/* Paleta de alerta — âmbar analítico */
--color-alert-700: #92660A;      /* Texto em fundos claros */
--color-alert-500: #C9A84C;      /* Bordas, badges, destaques */
--color-alert-100: #FFF8E1;      /* Fundo de ressalvas */

/* Paleta de status */
--color-success:   #2E7D52;      /* APROVADO, eventos aprovados */
--color-warning:   #C9A84C;      /* RESSALVAS, HITL aguardando */
--color-error:     #C62828;      /* REQUER_REVISÃO, alertas críticos */
--color-info:      #1565C0;      /* Informação contextual */
--color-neutral:   #757575;      /* Fases pendentes, inativo */

/* Superfícies */
--surface-base:    #FAFAFA;      /* Fundo principal da página */
--surface-card:    #FFFFFF;      /* Cards, painéis */
--surface-code:    #F4F4F4;      /* Blocos de código */
--surface-dark:    #1B3A2D;      /* Sidebar, headers */

/* Texto */
--text-primary:    #1A1A1A;      /* Texto principal */
--text-secondary:  #555555;      /* Texto auxiliar */
--text-tertiary:   #888888;      /* Metadados, timestamps */
--text-inverse:    #FFFFFF;      /* Texto sobre fundos escuros */
--text-code:       #D4E6D4;      /* Código em fundo escuro */

/* Bordas */
--border-default:  #D0D0D0;
--border-strong:   #BDBDBD;
--border-subtle:   #EEEEEE;
```

### 8.2 Tokens de tipografia

```css
--font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;

/* Escala tipográfica */
--text-xs:   11px;  line-height: 1.4;  /* Metadados, TAD codes, badges */
--text-sm:   12px;  line-height: 1.5;  /* Tabelas, conteúdo secundário */
--text-base: 14px;  line-height: 1.7;  /* Corpo de texto padrão */
--text-md:   16px;  line-height: 1.5;  /* Títulos de seção (h3) */
--text-lg:   18px;  line-height: 1.4;  /* Subtítulos (h2) */
--text-xl:   22px;  line-height: 1.3;  /* Títulos de página (h1) */

/* Peso */
--font-normal:  400;
--font-medium:  500;
--font-semibold:600;
--font-bold:    700;
```

### 8.3 Tokens de espaçamento

```css
/* Grid de 4px */
--space-1:  4px;
--space-2:  8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10:40px;
--space-12:48px;
```

### 8.4 Elevação e sombra

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.08);   /* Cards padrão */
--shadow-md:  0 4px 12px rgba(0,0,0,0.12);  /* Painéis, modais */
--shadow-lg:  0 8px 24px rgba(0,0,0,0.16);  /* Drawers, dropdowns */
```

### 8.5 Princípios visuais

1. **Hierarquia por peso, não por cor** — títulos em bold, metadados em regular. A cor é reservada para status e ação, não decoração.
2. **Verde = analítico, não "natureza"** — o verde profundo (#1B3A2D) remete a terminais e inteligência, não a bosques.
3. **Amber = atenção do analista** — usado exclusivamente para: RESSALVAS ATHENA, portões HITL, alertas não-críticos.
4. **Vermelho = ação imediata necessária** — REQUER_REVISÃO, erros críticos, alertas KRATOS disparados.
5. **Densidade máxima, zero ornamento** — sem gradientes decorativos, sem ícones de stock photography, sem animações que não carregam informação.

---

## PARTE 9 — COMPONENTES

### 9.1 PipelineTrack — trilho de fases

```
Comportamento:
- Mostra todas as N fases da metodologia ativa
- Estado de cada fase: pendente / ativo / concluído / erro / HITL
- Badge ATHENA por fase concluída: ✅ APROVADO / ⚠️ RESSALVAS / ❌ REQUER_REVISÃO
- Fase ativa mostra barra de progresso indeterminada (streaming)
- Clicável: expandir para ver keyFindings da fase

Props:
  phases: PhaseConfig[]
  currentPhaseIndex: number
  phaseOutputs: PhaseOutput[]   ← do banco
  onPhaseClick: (phaseIndex) => void
```

### 9.2 AthenaVerdict — badge de veredicto

```
Variantes:
  APROVADO        → fundo #E8F5E9, borda #2E7D52, texto "✅ APROVADO"
  RESSALVAS       → fundo #FFF8E1, borda #C9A84C, texto "⚠️ RESSALVAS"
  REQUER_REVISAO  → fundo #FFEBEE, borda #C62828, texto "❌ REQUER_REVISÃO"
  AGUARDANDO      → fundo #F5F5F5, borda #BDBDBD, texto "── PENDENTE"

Ao hover: tooltip com lista dos ATS checks (atsCode + passed + finding)

Props:
  verdict: 'APROVADO' | 'RESSALVAS' | 'REQUER_REVISAO' | null
  checks: AthenaCheck[]
  usedLLM: boolean
```

### 9.3 EventCard — card de evento/FPF

```
Layout:
  [tipo badge] Nome do evento                    [TAD badge] [status badge]
  "Descrição do evento..." (truncada, expandível)
  Fonte: [nome da fonte] · Fase: F2 · [timestamp]
  [✅ Aprovar]  [❌ Rejeitar]  (visível apenas em portão HITL)

Tipo badges:
  FPF  → fundo azul escuro  (#1565C0)
  TND  → fundo verde escuro (#1B5E20)
  INC  → fundo âmbar escuro (#E65100)
  FTR  → fundo cinza escuro (#424242)

TAD badge: "[Letra][Número]" — ex: "B2"
  Cor de fundo baseada na idoneidade:
    A, B → verde claro
    C, D → âmbar
    E, F → vermelho claro

factStatus badge:
  FATO      → verde (borda sólida)
  INDÍCIO   → âmbar (borda pontilhada)
  SUPOSIÇÃO → vermelho (borda tracejada)

Props:
  event: ProjectEvent
  showHitlActions: boolean
  onApprove: () => void
  onReject: () => void
```

### 9.4 PhaseOutputCard — artefato de fase

```
Layout:
  ┌─ Fase N · [label] · [nodeSlug]  [AthenaVerdict] ──────────────┐
  │  Summary (1 linha)                                             │
  │                                                                │
  │  FINDINGS (top 3)                                              │
  │  · [factStatus] [claim]                     [tadScore?]       │
  │  · [factStatus] [claim]                     [tadScore?]       │
  │  [+ N mais →]                                                  │
  │                                                                │
  │  Contexto: Xf/Yi/Zs · N eventos registrados · ATHENA: status  │
  └────────────────────────────────────────────────────────────────┘

Props:
  phaseOutput: PhaseOutput
  expanded: boolean
  onExpand: () => void
```

### 9.5 TADMeter — medidor de qualidade de fonte

```
Componente visual que representa a avaliação TAD (Técnica de Avaliação de Dados):

  Idoneidade:  A ●●●●●●  B ●●●●●○  C ●●●●○○  D ●●●○○○  E ●●○○○○  F ─────
  Credibilidade: 1 ●●●●●●  2 ●●●●●○  ... 6 ─────

  Código alfanumérico: "B2" exibido em destaque
  Significado semântico expandido no tooltip:
    "B = Habitualmente idônea · 2 = Provavelmente verdadeira"

Props:
  reliability: 'A'|'B'|'C'|'D'|'E'|'F'
  credibility: '1'|'2'|'3'|'4'|'5'|'6'
  showSemantic: boolean   ← expandido em contextos não militares
```

### 9.6 StreamingActivity — atividade ao vivo

```
Painel lateral que mostra:
  1. Token streaming de KLIO (fragmentos de texto)
  2. Tool calls em tempo real:
     - Nome da ferramenta
     - Parâmetros relevantes (truncados)
     - Resultado (sucesso/erro)
  3. Eventos registrados (tool_register_event)

Atualização via SSE (Server-Sent Events)
  type: 'token'   → append ao buffer de texto
  type: 'step'    → nova linha de atividade [KLIO] / [ATHENA]
  type: 'agent'   → mudança de agente ativo
  type: 'hitl_gate' → pausa para intervenção humana

Auto-scroll para o último evento (pausável pelo usuário)

Props:
  projectId: string
  isStreaming: boolean
  phaseLabel: string
```

### 9.7 LastroTree — árvore de rastreabilidade

```
Componente de visualização hierárquica:

  [Nível 1] Afirmação do relatório
  [Nível 2] Finding (claim + factStatus + tadScore)
  [Nível 3] Evento (project_event com sourceEvaluation)
  [Nível 4] Fonte (URL + avaliação TAD completa)
  [Nível 5] ATHENA check que validou este dado

Interação:
  - Click em qualquer nível → expande detalhes
  - Botão "Ver no relatório" → âncora no relatório
  - Botão "Ver evento" → abre EventCard
  - Botão "Exportar cadeia" → gera PDF de lastro

Props:
  findingClaim: string     ← ponto de entrada
  phaseOutputs: PhaseOutput[]
  projectEvents: ProjectEvent[]
```

---

## PARTE 10 — WIREFRAMES DETALHADOS

### 10.1 Dashboard (1440px desktop)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  OLYMPUS 1.0          ●●●          Gemini 2.5 Flash ▾    Admin ▾    ⚙     │
│  [260px sidebar]      [1180px main content]                                │
├───────────────┬────────────────────────────────────────────────────────────┤
│  SIDEBAR      │  DASHBOARD                                                 │
│  (dark bg)    │                                                             │
│               │  Bom dia, João.                              + Nova Análise│
│  [OLYMPUS]    │  Segunda-feira, 02 Jun 2026                                │
│               │                                                             │
│  ● Dashboard  │  ┌─────────────────────────────────────────────────────┐  │
│               │  │ ALERTAS ATIVOS                                       │  │
│  PROJETOS     │  │ 🔴 Análise Brasil 2050 · PIB > limiar → Cena A +20% │  │
│  ─────────    │  │ 🟡 Análise Defesa · Portão HITL aguardando           │  │
│  Projeto Alpha│  └─────────────────────────────────────────────────────┘  │
│  Cenário 2035 │                                                             │
│  [+ novo]     │  PROJETOS ATIVOS                                           │
│               │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  ADMIN        │  │ ● Alpha      │  │ ⏸ Defesa    │  │ ✅ 2035     │       │
│  ─────────    │  │ Grumbach F6  │  │ CEEEx HITL  │  │ Godet Done  │       │
│  Usuários     │  │ ████████░░   │  │ 12 aprovar  │  │ 14 Mai 2026 │       │
│  Audit Log    │  │ ATHENA: 5✅  │  │ [Abrir]     │  │ [Relatório] │       │
│  Config LLM   │  │ [Abrir]      │  │             │  │             │       │
│               │  └─────────────┘  └─────────────┘  └─────────────┘       │
│               │                                                             │
│               │  MÉTRICAS                                                  │
│               │  23 análises  ·  187 fases  ·  ATHENA: 94% ✅             │
└───────────────┴────────────────────────────────────────────────────────────┘
```

### 10.2 Tela de Projeto — Pipeline ativo

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Dashboard   Análise Brasil 2050                    🟢 Em execução      │
│  Grumbach · Modo Etapa · Google Gemini 2.5 Flash · Fase 6 de 9            │
├──────────────────────┬─────────────────────────────────────────────────────┤
│ PIPELINE (280px)     │ ATIVIDADE (flex 1)                                  │
│                      │                                                     │
│ ● F1 Delimitação ✅  │ ┌─ KLIO — Fase 6: Seleção das 4 Cenas ─────────── ─┐│
│ │  ✅ APROVADO        │ │                                                   ││
│ ● F2 Varredura  ✅   │ │ [streaming tokens]                                ││
│ │  ✅ APROVADO        │ │ "Analisando o histograma combinatório das          ││
│ ● F3 HITL       ✅   │ │  probabilidades P(i) e P(i|j) calculadas..."      ││
│ │  ✅ APROVADO        │ │                                                   ││
│ ● F4 Delphi     ✅   │ │ ── tool_register_scenario ─────────────────────── ││
│ │  ⚠️ RESSALVAS      │ │    name: "Cena A — Mais Provável"                 ││
│ ● F5 P(i|j)     ✅   │ │    type: inercial                                 ││
│ │  ✅ APROVADO        │ │    probability: 0.42                              ││
│ ◎ F6 Cenas      ████ │ │    fpf_states: { fpf-1: true, fpf-2: false... }  ││
│ │  ████████░░ ativo  │ │    ✅ Cenário registrado: #scen-uuid-a1b          ││
│ ○ F7 Narrativas      │ │                                                   ││
│ ○ F8 Indicações      │ └──────────────────────────────────────────────────┘│
│ ○ F9 Monitor         │                                                     │
│ ○ HERMES Síntese     │ EVENTOS DESTA FASE                                  │
│                      │ [FPF] Adoção IA militar    B2  ✅  [FPF-1]          │
│ ─────────────────    │ [FPF] Tensão OTAN leste    A2  ✅  [FPF-2]          │
│ Contexto compacto:   │ [TND] Multipolaridade       B3  ✅  [FPF-3]         │
│ 268 tokens · 5 fases │ [+ 9 mais]                                          │
│                      │                                                     │
│ [Pausar]  [Logs]     │ Fase concluída: aguardando ATHENA...               │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

### 10.3 Modal de Portão HITL

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░ FUNDO ESCURECIDO ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ⏸ PORTÃO HITL — Fase 3: Seleção de FPFs                             │  │
│  │ KLIO identificou 15 Fatos Portadores de Futuro. Selecione 10-15.    │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ [Aprovar todos]  [Selecionar top-10 por TAD]  [Filtrar ▾]  [Buscar] │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                      │  │
│  │ ☑  FPF-01  Adoção IA em comando militar              B2  [FATO]   │  │
│  │            RAND Corporation · habitualmente idônea               │  │
│  │            "Projeção de adoção >60% até 2030..."                  │  │
│  │                                                                      │  │
│  │ ☑  FPF-02  Tensão OTAN — leste europeu                A2  [FATO]   │  │
│  │            Reuters · totalmente idônea                            │  │
│  │                                                                      │  │
│  │ ☐  FPF-03  Fragmentação multilateralismo WTO          C3  [INDÍCIO] │  │
│  │            FMI · regularmente idônea                             │  │
│  │                                                                      │  │
│  │ ☑  FPF-04  Emergência China como polo tecnológico     A1  [FATO]   │  │
│  │            [+ 11 mais]                                            │  │
│  │                                                                      │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 12/15 selecionados  · Seleção válida: ✅ (entre 10 e 15)             │  │
│  │                                                                      │  │
│  │ Instrução opcional para KLIO na próxima fase:                       │  │
│  │ ┌────────────────────────────────────────────────────────────────┐  │  │
│  │ │ "Priorizar FPFs relacionados a tecnologia e defesa..."         │  │  │
│  │ └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │                    [Cancelar]  [Continuar análise →]                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Tela ATHENA — detalhe completo

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Análise Brasil 2050   ATHENA — Auditoria Analítica                       │
├──────────────────────┬─────────────────────────────────────────────────────┤
│ FASES (240px)        │ DETALHE: Fase 5 — Impacto Cruzado P(i|j)            │
│                      │                                                     │
│ F1 Deli... ✅ ATS3✓  │ node_modeling · KLIO · 02 Jun 2026, 12:34           │
│ F2 Varr... ✅ ATS1✓  │                                                     │
│ F3 HITL    ✅        │ ┌─ VEREDICTO ────────────────────────────────────┐  │
│ F4 Delp ⚠️ ATS2⚠    │ │  ✅ APROVADO · Verificação: Determinística     │  │
│ F5 P(i|j)  ✅        │ │     LLM usado: Não                             │  │
│ F6 Cenas   ✅        │ └────────────────────────────────────────────────┘  │
│ F7 Narr.   ─         │                                                     │
│ F8 Indic.  ─         │ ATS2 ✅  Linguagem calibrada (Hendrikson)           │
│ F9 Mon.    ─         │ "Qualificador 'provável' detectado em               │
│                      │  FPF-1, FPF-3, FPF-5, FPF-7, FPF-9"               │
│ ──────────────────── │                                                     │
│ SUMÁRIO              │ ATS8 ✅  Precisão das estimativas                  │
│ 5 ✅ APROVADO         │ "8 hipóteses/incertezas distintas com              │
│ 1 ⚠️ RESSALVAS        │  delimitação de horizonte temporal"                │
│ 0 ❌ REQUER_REV.       │                                                     │
│                      │ ── KEY FINDINGS DESTA FASE ─────────────────────── │
│ ──────────────────── │                                                     │
│ ICD 203 Coverage     │ [FATO B2] FPF-1 P(i)=0.72 → muito provável        │
│ ATS1: 5/5 ✅          │           Cena A e Cena D dependem deste FPF       │
│ ATS2: 4/4 ✅          │           C(j)=0.428 → C_aj=0.857 → P(j|i)=46%   │
│ ATS3: 1/1 ✅          │                                                     │
│ ATS6: — (pendente)   │ [FATO A2] FPF-2 P(i)=0.85 → quase certo           │
│ ATS8: 2/2 ✅          │           I(2,1)=1.8 — triplica chance de FPF-1   │
│ ATS9: — (pendente)   │                                                     │
│                      │ [INDÍCIO C3] FPF-7 P(i)=0.35 → possível            │
│                      │             Elo mais fraco identificado             │
│                      │             por KLIO                                │
└──────────────────────┴─────────────────────────────────────────────────────┘
```

### 10.5 Responsividade — breakpoints

```
1440px (Desktop)    → Layout completo: sidebar 260px + conteúdo 1180px
1024px (Tablet)     → Sidebar colapsável (ícones apenas)
                      Conteúdo ocupa toda a largura
768px  (Tablet P.)  → Sidebar como drawer inferior
                      Pipeline e atividade em stack vertical
480px  (Mobile)     → Interface simplificada — apenas leitura/aprovação HITL
                      Pipeline como lista simples
                      Streaming oculto (somente badges de status)
```

---

## NOTAS DE IMPLEMENTAÇÃO PARA O DESENVOLVEDOR

### Prioridade de implementação

1. **[P0]** `PipelineTrack` — substitui a barra de progresso atual; bloqueia todas as outras telas
2. **[P0]** `AthenaVerdict` badge — aparece em toda a UI; precisa ser consistente
3. **[P1]** `EventCard` com estado HITL — substitui a tabela flat atual
4. **[P1]** Modal de HITL — Portão da Fase 3 Grumbach
5. **[P2]** Tela ATHENA — nova tela; depende de phase_outputs no banco
6. **[P2]** Tela Lastro — nova tela; lógica de rastreabilidade complexa
7. **[P3]** Dashboard redesign — melhoria incremental sobre o existente

### Dados disponíveis no frontend via API existente

| Dado | Endpoint disponível |
|---|---|
| Fases da metodologia | `loadMethodology()` em chat.ts → passa no initialState |
| `currentPhaseIndex` | SSE event `type: 'status'` + estado LangGraph |
| Eventos do projeto | `GET /api/v1/events/:projectId` |
| Phase outputs | **NOVO** — precisa de endpoint `GET /api/v1/phases/:projectId` |
| ATHENA checks | **NOVO** — dentro de phase_outputs |
| Cenários | `GET /api/v1/sessions/:id` (project_scenarios) |

### Endpoint novo necessário

```typescript
// GET /api/v1/phases/:projectId
// Response: PhaseOutput[]
// Usado por: PipelineTrack, Tela ATHENA, Tela Lastro
```

---

*OLYMPUS 1.0 — UI Design Specification v1.0*  
*Principal Product Designer — Palantir Framework*  
*Para implementação pós-validação da metodologia Grumbach completa*
