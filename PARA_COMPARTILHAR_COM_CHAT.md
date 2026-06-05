# PARA O CHAT — Contexto da Implementação GRUMBACH e Roadmap

Olá Chat. Você mapeou as metodologias (SIEX, ALTA, CEEEX, PESTEL, Grumbach) e tem todo o material de referência. Agora preciso que você:

1. **Leia `SPRINT_25_DIAGNOSTICO_FINAL.md`** (arquivo anexado) — consolida 7 bugs resolvidos em Sprint 25, 4 bugs persistentes/novos do teste mais recente, e contexto arquitetural crítico.

2. **Produza um diagnóstico** da implementação atual de Grumbach (quais partes estão solidificadas, quais precisam reforço antes de replicar para outras metodologias).

3. **Elabore um guia de correção** para:
   - Bug #1 (ATHENA vendo dados incompletos em fase 1 mesmo após fix)
   - Bug #2 (Varredura FPF fracionada em fase 2)
   - Bug #3 (Visualização gráfica do Delphi)
   - Bug #4 (Visualização gráfica de Impactos Cruzados)
   - Bug #5 (Fase 6 reprovações cascateando para fase 7)

4. **Responda estas dúvidas críticas** que definem a roadmap para outras metodologias:

   **4.1 — Validação de Status de Eventos**  
   Em etapa mode, resumeGraph é chamado quando usuário clica "Confirmar". O PATCH que marca events como 'approved' acontece antes ou depois de resumeGraph?  
   → Isso determina se ATHENA vê dados corretos.

   **4.2 — Estrutura de Dados para Visualizações**  
   - Delphi P(i): Está armazenado como texto em project_events.description ou há tabela estruturada?
   - Impactos: Há tabela impactRelations ou extraio de events via parsing?
   → Determina se vou criar componentes React ou refatorar backend.

   **4.3 — Identificação de Cenário Alvo**  
   No log, "Cena D — Alvo" aparece como scenario type='target'. ATHENA distingue os 4 cenários por type, ordem ou semanticamente no texto?
   → Preciso saber como construir selector para "cenário alvo" em fases 8-9.

   **4.4 — Contaminação de Contexto Entre Fases**  
   buildAnchorCtx carrega approved events de fases anteriores. Se fase 1 criasse narrativa (bug histórico), fase 2 a herdaria?  
   → Devo confiar que allowedTools força comportamento correto ou adicionar filtro por tipo/fase?

   **4.5 — Curva de Aprendizado de KLIO**  
   KLIO recebe systemPromptInject com instruções textuais por fase, mas sem exemplos concretos de outputs esperados.  
   Para Grumbach (já implementado e testado), KLIO está gerando outputs corretos?  
   → Isso me diz se preciso fine-tuning ou RAG de exemplos quando mudar para SIEX/ALTA.

5. **Template para Próxima Metodologia**  
   Uma vez que entender as respostas acima, vou precisar de um template PhaseConfig limpo e conjunto de regras de "o que é seguro reutilizar de Grumbach e o que muda por metodologia".

---

## Context Atual

- **Commit:** 4484711 (Sprint 25i) — 9 fases Grumbach implementadas, 7 bugs resolvidos
- **Modo Implementado:** etapa (aprovação per-fase) + passagem (totalmente autônoma)
- **Agentes:** KLIO executa fases, HERMES sintetiza, ATHENA audita deterministicamente
- **SSE Events:** agent, step, token, done, phase_output, athena, hitl_gate
- **Teste End-to-End:** Completo, 4 novos issues identificados (veja diagnóstico)

---

## Logs e Evidências

**Log de Execução (último teste):** C:\Users\jomar\Downloads\log.txt  
**Transcript de Chat:** C:\Users\jomar\Downloads\MSG_LOCALHOST (1).md  
**Diagnóstico Detalhado:** SPRINT_25_DIAGNOSTICO_FINAL.md

---

Aguardando seu diagnóstico e guia. Qualquer dúvida sobre o código, estou aqui.
