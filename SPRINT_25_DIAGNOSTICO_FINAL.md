# SPRINT 25 — Diagnóstico e Roadmap da Implementação GRUMBACH

**Data:** 2026-06-05  
**Status:** 7 bugs resolvidos em Olympus 1.0; 4 bugs persistentes/novos identificados no último teste  
**Commit atual:** 4484711 (Sprint 25i)  
**Containers:** Saudáveis, seed aplicado com sucesso (9/9 fases)

---

## I. SÍNTESE EXECUTIVA — O QUE FOI FEITO EM SPRINT 25

### Contexto
A metodologia **Grumbach 9 fases** foi implementada com suporte a dois modos de análise:
- **etapa:** Per-fase com aprovação/rejeição do analista antes de ATHENA auditar
- **passagem:** Totalmente autônoma (auto-aprovação automática de todos os eventos)

Sprint 25 resolveu uma cascata de bugs críticos no estado machine de HITL, comportamento de ATHENA, e apresentação de eventos ao usuário.

### Commits e Correções por Sprint

| Sprint | Commit | Problema | Solução | Status |
|--------|--------|----------|---------|--------|
| 25a | bda2376 | Phase counter mostra 8/9 no início | Rastreamento apenas via 'athena' SSE, nunca de hitl_gate | ✅ RESOLVIDO |
| 25a | bda2376 | ATHENA reprova fase 1 sem contexto | declarar_julgamento agora cria event com premissa-linchpin | ✅ RESOLVIDO |
| 25b | 6a8e6e8 | HITL button não avança | Mudança vizMode default: 'passos' → 'etapa' | ✅ RESOLVIDO |
| 25c | 10db088 | Cache polling excessivo (20ms) | Intervalo 300s + phaseConfigCache status | ✅ RESOLVIDO |
| 25d | a5c1c84 | OLYMPUS sintetiza em vez de HERMES | Removida lógica condicionada; busca HERMES por nome | ✅ RESOLVIDO |
| 25e | 8f0e8e2 | Phase output desaparece em etapa mode | Adicionado phase_output SSE antes de interrupt | ✅ RESOLVIDO |
| 25f | 40f1f29 | Fase 5-9: keyFindings.description undefined | Adicionado description opcional em KeyFinding | ✅ RESOLVIDO |
| 25g | 5f7c9e4 | currentPhaseNum avança em hitl_required | Removida setCurrentPhaseNum do handler hitl_gate | ✅ RESOLVIDO |
| 25h | 2ef6e1a | ATHENA audita ANTES da aprovação do usuário | Movido audit para APÓS interrupt (pós-resumeGraph) | ✅ RESOLVIDO |
| 25i | 4484711 | ATHENA REQUER_REVISAO sem contexto; FPFs fracionados; eventos mal-rotulados | Checks array + fase 1 sem FPFs + semantic labels | ✅ RESOLVIDO |

---

## II. BUGS RESOLVIDOS — CAUSA RAIZ E SOLUÇÃO

### Bug #1: Phase Counter Mostrando 8/9 (Sprint 25a)
**Sintoma:** Na inicialização da análise, display mostra "Fase 8 de 9" em vez de "Fase 1 de 9".

**Causa raiz:**  
O frontend rastreava `currentPhaseNum` a partir de dois eventos conflitantes:
- `hitl_gate` SSE (com phaseNum = PRÓXIMA fase a executar)
- Reverse scan de mensagens KLIO (encontrava "KLIO" em qualquer fase anterior)

**Solução:**  
Definição de autoridade único: **apenas 'athena' SSE event atualiza `currentPhaseNum`**, pois:
- ATHENA dispara APÓS a fase completar
- Seu phaseNum é a fase que acabou de passar por auditoria
- É a única fonte confiável de sequência

**Arquivo:** `apps/web/src/hooks/useChat.ts`
```typescript
case 'athena':
  setCurrentPhaseNum(phaseNum); // <-- ÚNICA fonte de verdade
  // hitl_gate não atualiza currentPhaseNum
```

---

### Bug #2: ATHENA Reprova Fase 1 Sem Dados (Sprint 25a)
**Sintoma:** ATHENA emite "REQUER_REVISAO — ATS3 FALHA: nenhuma premissa-linchpin declarada" mas KLIO havia criado o linchpin.

**Causa raiz:**  
Fase 1 usa `declarar_julgamento` para registrar o linchpin, mas a ferramenta **não criava um project_event**. ATHENA busca keyFindings dos events registrados; se nenhum event foi criado, keyFindings fica vazio.

**Solução:**  
Modificado `tool_declarar_julgamento` para chamar `tool_register_event` internamente quando `premissaLinchpin` é fornecido, criando um event tipo 'assumption' com nome "Premissa-Linchpin: [...]".

**Arquivo:** `apps/api/src/tools/tool_declarar_julgamento.ts`

---

### Bug #3: HITL Confirm Button Não Avança (Sprint 25b)
**Sintoma:** Botão "Confirmar" na tela HITL fica inativo; análise não avança.

**Causa raiz:**  
O default de `vizMode` era 'passos' (removido da UI em Sprint 24). Fase 3 (FPF selection) tem `requiresHitlBefore=true`, disparando `hitl_required` interrupt. Em 'passos' mode, esse interrupt não tinha handler na UI (UI apenas tinha "Continuar" para phase_complete, não hitl_required).

**Solução:**  
1. Mudado vizMode default de 'passos' para 'etapa' em `chat.ts`
2. Confirmado que 'etapa' mode é: KLIO propõe → usuário aprova/rejeita → ATHENA audita
3. Confirmado que 'passagem' mode é: KLIO propõe → auto-aprova todos → ATHENA audita → continua

**Arquivo:** `apps/api/src/routes/chat.ts:81`

---

### Bug #4: Cache Polling Excessivo (Sprint 25c)
**Sintoma:** Frontend faz 50+ requisições por segundo para `/settings/cache/status`.

**Causa raiz:**  
`useEffect` em `SettingsCache.tsx` disparava polling a cada 20ms sem intervalo.

**Solução:**  
Intervalo ajustado para 300s (TTL do cache). Adicionado status de `phaseConfigCache` junto a `methodologyCache`.

**Arquivo:** `apps/web/src/components/admin/SettingsCache.tsx`

---

### Bug #5: OLYMPUS Sintetiza em Vez de HERMES (Sprint 25d)
**Sintoma:** Relatório final assinado por "OLYMPUS" em vez de "HERMES"; conteúdo incompleto.

**Causa raiz:**  
`synthesisNode` tinha lógica condicional:
```typescript
const agentChoice = !agentMethodPrompts?.["OLYMPUS"] 
  ? ["HERMES", "OLYMPUS"] 
  : ["OLYMPUS", "HERMES"];
```
Isso inverte a prioridade quando OLYMPUS não está no mapa (Olympus 1.0 não o implementa).

**Solução:**  
Removida condição; query direta do agent "HERMES" por nome. HERMES é o orquestrador designado em Olympus 1.0.

**Arquivo:** `apps/api/src/graph/nodes.ts` (synthesisNode)

---

### Bug #6: Phase Output Desaparece em Etapa Mode (Sprint 25e)
**Sintoma:** Em etapa mode, a bolha de streaming de KLIO desaparece após ATHENA auditar, levando ao contexto perdido.

**Causa raiz:**  
Em etapa mode, não há `phase_complete` interrupt após ATHENA (cada fase tem seu próprio hitl_gate para aprovação do usuário). A bolha de streaming é deletada ao chegá ao done; sem `phase_complete` SSE, o frontend nunca cria uma mensagem permanente.

**Solução:**  
Adicionado `phase_output` SSE event **antes** de interrupt em `phaseLoopNode`. Frontend handler (useChat.ts) persiste como mensagem permanente no histórico.

**Arquivo:** `apps/api/src/graph/nodes.ts` (phaseLoopNode) + `apps/web/src/hooks/useChat.ts`

---

### Bug #7: Fases 5-9 Reprovadas por ATHENA (ATS2 Falha) (Sprint 25f)
**Sintoma:** Fase 5+ consistentemente reprovadas com "ATS2 FALHA: nenhum qualificador Hendrikson".

**Causa raiz:**  
Fases 5-9 usam `tool_register_scenario` e `tool_register_impact_relation` (sem descrição qualitativa). ATHENA procura qualificadores Hendrikson dentro de `claim + description`. Se description era undefined, ATS2 falhava.

**Solução:**  
1. Adicionado campo `description?: string` opcional em `KeyFinding` interface
2. buildAnchorCtx mapeado `project_events.description` → KeyFinding.description
3. ATS2 agora busca em `f.claim + ' ' + (f.description ?? '')`

**Arquivo:** `apps/api/src/graph/athena-validator.ts` + `apps/api/src/graph/nodes.ts`

---

### Bug #8: currentPhaseNum Avança em hitl_required (Sprint 25g)
**Sintoma:** Phase counter salta para fase seguinte quando hitl_required é disparado (não esperado).

**Causa raiz:**  
O handler de 'hitl_gate' chamava `setCurrentPhaseNum(phaseNum)`, e phaseNum é a fase **seguinte** a executar (não a que acabou de completar).

**Solução:**  
Removida `setCurrentPhaseNum` de hitl_gate handler. Apenas 'athena' event atualiza o contador (implementado em Bug #1).

**Arquivo:** `apps/web/src/hooks/useChat.ts`

---

### Bug #9: ATHENA Audita Antes da Aprovação do Usuário (Sprint 25h) ⭐ **CRÍTICO**
**Sintoma:** Mensagem "ATHENA aprova a Fase 1" aparece **antes** do usuário confirmar a aprovação dos FPFs.

**Causa raiz:**  
`athenaAuditPhase()` era chamado em `phaseLoopNode` **antes** do interrupt. Naquele ponto, os eventos ainda tinham status='proposed' (não aprovados). O comportamento correto de etapa mode é:
1. KLIO executa → gera events com status='proposed'
2. **Interrupt → usuário aprova/rejeita → atualiza status='approved'**
3. ATHENA audita apenas events com status='approved'

**Solução:**  
Movida chamada `athenaAuditPhase()` para **após** o `interrupt()` — agora é chamada no resumeGraph, após o usuário confirmar. phaseLoopNode emite `phase_output` SSE (com ATHENA verdict) apenas depois da auditoria.

**Arquivo:** `apps/api/src/graph/nodes.ts` (phaseLoopNode → moved ATHENA call)

**Implicação arquitetural:** Este bug era um violação do contrato etapa mode. Agora KLIO e ATHENA respeitam a sequência: KLIO propõe → Usuário aprova → ATHENA valida.

---

### Bug #10: ATHENA REQUER_REVISAO Sem Contexto (Sprint 25i)
**Sintoma:** Quando ATHENA reprova uma fase, mensagem só mostra o veredicto; usuário não sabe qual check falhou.

**Causa raiz:**  
Callback `onAthena` passava apenas `{ verdict, phaseNum, label, usedLlm }`. A array de checks (que detalha quais ATS falharam) não era transmitida ao frontend.

**Solução:**  
1. Expandido tipo de `onAthena` callback para incluir `checks` array
2. phaseLoopNode extrai checks do athenaVerdict e passa ao callback
3. useChat.ts formata checks falhados na mensagem:
   ```
   ❌ Fase 3 — Seleção de FPFs · ATHENA: REQUER_REVISAO
   
   Verificações reprovadas:
   - `ATS1` FPF-2 sem score TAD
   - `ATS3` Linchpin não declarada
   ```

**Arquivo:** `apps/api/src/graph/builder.ts` + `apps/api/src/graph/nodes.ts` + `apps/web/src/hooks/useChat.ts`

---

### Bug #11: FPFs Apresentadas Fracionadas (Sprint 25i)
**Sintoma:** Fase 1 cria "FPFs preliminares"; Fase 2 cria "FPFs definitivOs"; HITL gate mostra 31 FPFs em vez de ~5.

**Causa raiz:**  
Fase 1 (Delimitação) tinha `tool_register_event` em allowedTools, criando FPFs. Fase 2 (Varredura) criava mais FPFs. Usuário feedback: "Todos devem ser apresentados ao mesmo tempo, na fase de varredura."

**Solução:**  
1. Removido `tool_register_event` de allowedTools em Fase 1
2. Fase 1 agora **apenas** declara escopo + linchpin via `declarar_julgamento`
3. FPFs "preliminares" permanecem como texto narrativo, nunca como eventos
4. Fase 2 (Varredura) é a **única** a registrar FPFs como events
5. Fases 5-9 registram seus produtos (impactos, cenários, narrativas, signposts)

**Arquivo:** `apps/api/src/graph/phase-configs/grumbach.ts`

---

### Bug #12: Eventos Incorretamente Rotulados como "FPF" (Sprint 25i)
**Sintoma:** No painel HITL, Delphi P(i), impactos cruzados, cenários e narrativas recebem tag "FPF", induzindo ao erro.

**Causa raiz:**  
Todos os events com type='fpf' recebem label "FPF" no EventsPanel. Mas nem todos os products das fases são FPFs:
- Fase 2: FPFs (legítimos)
- Fase 4: Delphi P(i) (probabilidades, não FPFs)
- Fase 5: Impactos cruzados
- Fase 6: Cenários (antes "Cena A/B/C/D")
- Fase 7: Narrativas de cenários
- Fase 9: Signposts com limiares

**Solução:**  
Implementada `getSemanticLabel(event)` que detecta tipo de evento a partir do nome:
```typescript
if (name.startsWith('p(i)'))               return 'Delphi P(i)';
if (name.startsWith('impacto '))           return 'Impacto Cruzado';
if (name.startsWith('cena ') || ...)       return 'Cenário';  // <-- corrigido termo
if (name.startsWith('narrativa '))         return 'Narrativa';
if (name.startsWith('se ') && ...)         return 'Signpost';
if (name.startsWith('premissa-linchpin')) return 'Linchpin';
```

**Arquivo:** `apps/web/src/components/layout/EventsPanel.tsx`

---

## III. BUGS PERSISTENTES E NOVOS DO ÚLTIMO TESTE (2026-06-05)

### Teste End-to-End: Cenários de Geopolítica Brasil
**Duração:** Completa (9 fases)  
**Modo:** etapa (aprovação per-fase)  
**Resultado:** Sistema funcionou, mas 4 problemas de UX/implementação

---

### ⚠️ **Novo Bug #1: ATHENA Reprova Fase 1, KLIO Havia Criado Dados**
**Observação:** "ATHENA aprovou a Fase 1 antes do Usuário confirmar os FPF... O certo é: KLIO lê escopo => propões FPF => Usuário aprova, rejeita ou redireciona => ATHENA analisa"

**Diagnóstico:**  
O último fix (Sprint 25h) moveu ATHENA para pós-interrupt. Mas parece que em etapa mode, ainda existe um momento em que ATHENA vê dados incompletos.

**Possível causa:**  
- `declarar_julgamento` em fase 1 não está criando o event corretamente?
- Ou buildAnchorCtx não está capturando FPFs do event registrado?
- Ou ATHENA está rodando duas vezes (uma vez pré-interrupt, uma vez pós)?

**Necessário investigar:**  
1. Verificar se 'Premissa-Linchpin' event está sendo criado
2. Verificar se phase_output de fase 1 tem keyFindings não-vazio
3. Confirmar que ATHENA roda exatamente 1 vez por fase

---

### ⚠️ **Novo Bug #2: Varredura de FPF Feita Aos Pedaços**
**Observação:** "Varredura de FPF na fase 2 feita aos pedaços, não foram apresentadas de uma vez"

**Diagnóstico:**  
Fase 2 cria múltiplos FPFs. Se KLIO está emitindo-os incrementalmente (cada tool_register_event envia um KLIO ·), o frontend pode estar mostrando-os fracionados. Ou há problema com como buildAnchorCtx carrega FPFs anteriores.

**Necessário:**  
1. Confirmar que phase 2 allowedTools inclui tool_register_event ✅
2. Verificar se KLIO está disparando tool_register_event múltiplas vezes em phase 2
3. Confirmar que todos os FPFs aparecem no phase_output.keyFindings de fase 2

---

### ⚠️ **Novo Bug #3: Resultado Delphi Não Mostrado Graficamente**
**Observação:** "O resultado da Simulação Delphi não mostrou o resultado para o usuário e houve reprovações de ATHENA. O resultado do Delphi tem que ser apresentado de forma gráfica"

**Diagnóstico:**  
Fase 4 (Delphi) registra Delphi P(i) events, mas a UI não renderiza a matriz de probabilidades ou visualização dos resultados.

**Necessário:**  
1. Criar componente React para exibir matriz Delphi (FPFs × P(i) com qualificadores Hendrikson)
2. Componente renderiza após phase_output SSE de fase 4
3. Exemplo esperado: Tabela com FPFs + suas probabilidades (quase certo / muito provável / etc.)

---

### ⚠️ **Novo Bug #4: Matriz de Impactos Cruzados Não Visualizada**
**Observação:** "O resultado da matriz de impactos cruzados tem que ser apresentada de forma gráfica"

**Diagnóstico:**  
Fase 5 (Impacto Cruzado) registra impactScore (0-3) entre FPFs, mas a UI não renderiza a matriz 2D ou heatmap.

**Necessário:**  
1. Criar componente React para exibir matriz Motricidade × Dependência
2. Renderizar após phase_output SSE de fase 5
3. Exemplo: Heatmap 5×5 (ou N×N) com cores indicando motricidade/dependência

---

### ⚠️ **Novo Bug #5: Falhas em Fase 6 Causam Problemas em Redação de Cenários**
**Observação:** "As falhas apontadas por ATHENA tiveram como consequência problemas na redação dos cenários"

**Diagnóstico:**  
ATHENA reprovou fase 6 por insuficiência de cenários ou qualidade. Ao resumir a análise, KLIO na fase 7 (narrativas) recebe keyFindings de fase 6 que não passaram em auditoria.

**Necessário:**  
1. Investigar por que ATHENA reprova fase 6 (qual ATS check falha?)
2. Verificar se buildAnchorCtx deve ignorar phase_outputs com verdict='REQUER_REVISAO'
3. Confirmar que narrativas (fase 7) só usam scenarios aprovados

---

### 📝 **Correção Terminológica: "Cena" → "Cenário"**
**Observação:** "O termo correto para as fases 6 e 7 é CENÁRIO, e não CENA"

**Recomendação:**  
1. Renomear todas as referências em systemPromptInject de grumbach.ts:
   - "Cena A / B / C / D" → "Cenário A / B / C / D"
   - Em phase 6 e 7
2. Atualizar ATHENA checks em athena-validator.ts:
   - Permitir ambos "cenário" e "cena" na detecção (por compatibilidade histórica)
   - Mas preferir "cenário" em novos prompts
3. Atualizar exemplo em stress_test (se houver)

---

## IV. ESTADO ATUAL DA IMPLEMENTAÇÃO

### O Que Funciona ✅

1. **Motor LangGraph 2-node (phaseLoopNode → synthesisNode)**
   - Fase loop com checkpoint persistence
   - Estado rastreado via OlympusStateAnnotation
   - 9 fases Grumbach mapeadas

2. **HITL State Machine (etapa mode)**
   - Per-fase: Usuário aprova/rejeita eventos antes de ATHENA
   - ATHENA audita apenas status='approved'
   - Resumes preservam hitlGate em erros transitórios (503)

3. **ATHENA Determinística**
   - ATS1-ATS9 checks estruturais
   - Checks array com detalhes de falhas
   - Auditoria **apenas** após aprovação do usuário

4. **Event Panel + Semantic Labels**
   - Delphi P(i), Impactos, Cenários, Narrativas, Signposts
   - Cada tipo recebe label apropriado (não "FPF" genérico)

5. **Phase Config Dinâmico**
   - Fases carregadas do banco, não hardcoded
   - allowedTools por fase
   - systemPromptInject controlado

6. **SSE Streaming**
   - agent, step, token, done, phase_output, athena, hitl_gate

### O Que Falta / Precisa Melhorar ⚠️

1. **Visualizações Gráficas**
   - [ ] Matriz Delphi (FPFs × P(i))
   - [ ] Matriz Impactos Cruzados (Motricidade × Dependência)
   - [ ] Possivelmente gráfico de signposts com limiares

2. **Auditoria Qualitativa LLM (Olympus 1.1)**
   - runQualitativeAudit() ainda retorna stub
   - Será implementado após validação estrutural

3. **Detecção Robusta de Dados Incompletos**
   - Bug #1 sugeriu ATHENA vendo dados faltantes em fase 1
   - Necessário debugar exatamente o que buildAnchorCtx carrega

4. **Rate Limit**
   - Atual: 30/hora (adequado para 19 POSTs etapa mode)
   - Pode escalar se polling/re-tries aumentarem

---

## V. ROADMAP — PREPARAÇÃO PARA OUTRAS METODOLOGIAS

### Requisitos Arquiteturais para Nova Metodologia

**Antes de implementar SIEX / ALTA / CEEEX:**

1. **Phase Config Template**
   ```typescript
   // apps/api/src/graph/phase-configs/<slug>.ts
   export const PHASES: PhaseConfig[] = [
     {
       phaseIndex: 0,
       phaseSlug: "phase_1_name",
       nodeSlug: "node_framing",         // ou outro nó LangGraph
       systemPromptInject: "...",         // SEM descrever outras fases
       allowedTools: ["tool1", "tool2"],
       requiresHitlBefore: false,
       label: "Fase 1 — ...",
     },
     // ... mais fases
   ];
   ```

2. **Estrutura de Dados**
   - Decidir se project_events type='fpf' é reusável ou precisa novo tipo
   - TAD format: SIEX/ALTA/CEEEX usam `[B2]` alphanumério; buildAnchorCtx deve aceitar `methodology` para formatar

3. **ATHENA Checks Específicos**
   - Expandir STRUCTURAL_CHECKS para nodes específicos da nova metodologia
   - Exemplo: node_siex_diag poderia ter ATS10, ATS11 custom

4. **Agents Reutilizados**
   - KLIO executa todas as fases em todas as metodologias
   - HERMES sintetiza sempre
   - ATHENA audita sempre

5. **Integração de Checkpoint**
   - Cada metodologia usa PostgresSaver de LangGraph
   - clearCheckpointSql() em chat.ts é agnóstico à metodologia

---

## VI. DÚVIDAS CRÍTICAS PARA O CHAT

Antes que o Chat elabore um guia de correção, preciso de clareza sobre:

### 1. **Quando ATHENA Vê Dados Incompletos?**
   - Em etapa mode, ATHENA é chamado APÓS resumeGraph
   - resumeGraph é chamado quando o usuário clica "Confirmar"
   - Status dos events deve ser 'approved' naquele ponto
   - **Pergunta:** Como validar que status='approved' está sendo setado corretamente no batch PATCH?

### 2. **Delphi E Impacto Cruzado — Onde Vai A Visualização?**
   - Hoje: events são armazenados como text em project_events.description
   - Frontend renderiza apenas texto
   - **Pergunta:** Há tabela de dados estruturados para Delphi P(i) ou será parsing do texto?
   - **Pergunta:** Matriz de impactos — há tabela impactRelations ou vou extrair de project_events?

### 3. **Fases 6-7: Qual É o Cenário "Alvo"?**
   - Log mostra Cena D como "alvo" (target), Cena A como "mais provável"
   - **Pergunta:** Como ATHENA distingue entre os 4 cenários? Por tipo, por ordem de criação, ou por campo específico?

### 4. **Contaminação de Contexto em Phase 2+**
   - buildAnchorCtx carrega approved events de fases anteriores
   - Se fase 1 produziu narrativa (antes do fix), phase 2 as herdaria?
   - **Pergunta:** Devo filtrar buildAnchorCtx por phase/tipo, ou esperar que allowedTools force correto?

### 5. **Modo Passagem vs. Etapa — Qual Será Default?**
   - Hoje: default é 'etapa' (user-intensive)
   - Passagem foi testado? Qual é a experiência esperada?
   - **Pergunta:** Para SIEX/ALTA, haverá modos diferentes ou sempre etapa?

### 6. **Qual é a Curva de Aprendizado de KLIO em Nova Metodologia?**
   - KLIO recebe systemPromptInject com instruções por fase
   - Mas não tem exemplos concretos de output esperado
   - **Pergunta:** Será necessário fine-tuning ou RAG de exemplos anteriores?

---

## VII. CHECKLIST PARA PRÓXIMA EXECUÇÃO

- [ ] Validar que ATHENA roda **exatamente uma vez** por fase (logs)
- [ ] Confirmar que status='approved' é setado no PATCH de eventos
- [ ] Adicionar visualização Delphi (matriz FPFs × P(i))
- [ ] Adicionar visualização Impactos Cruzados (matriz 5×5 Motricidade × Dependência)
- [ ] Renomear "Cena" → "Cenário" em systemPromptInject
- [ ] Executar novo teste end-to-end com logs detalhados de phase outputs
- [ ] Documentar formato esperado de buildAnchorCtx para cada fase
- [ ] Preparar template PhaseConfig para próxima metodologia

---

## VIII. REFERÊNCIAS CRÍTICAS

| Arquivo | Função | Crítico Para |
|---------|--------|--------------|
| `apps/api/src/graph/nodes.ts` | phaseLoopNode, synthesisNode | Orquestração, ATHENA timing |
| `apps/api/src/graph/athena-validator.ts` | Checks ATS1-ATS9 | Lógica de auditoria |
| `apps/api/src/graph/phase-configs/grumbach.ts` | PHASE_CONFIGS, allowedTools | Sequência de fases, ferramentas |
| `apps/api/src/routes/chat.ts` | SSE streaming, clearCheckpointSql | Ciclo de vida de projeto |
| `apps/web/src/hooks/useChat.ts` | SSE event handling, currentPhaseNum | Rastreamento de estado frontend |
| `apps/web/src/components/layout/EventsPanel.tsx` | Semantic labels | Apresentação de eventos |
| `packages/core/src/state.ts` | OlympusStateAnnotation | Schema de estado global |
| `HISTORICO_DESENVOLVIMENTO.md` | Decisões arquiteturais Sprint 1-24 | Contexto histórico |

---

**Pronto para diagnóstico e guia de implementação.**
