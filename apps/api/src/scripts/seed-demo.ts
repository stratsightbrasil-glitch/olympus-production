/**
 * seed-demo.ts — Popula o banco com dados de demonstração para PoC.
 * Execução: node /app/apps/api/dist/scripts/seed-demo.js
 * Idempotente: pode ser executado múltiplas vezes sem duplicar dados.
 */
import 'dotenv/config';
import path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../../../../.env') });

import { db, users, projects, messages as messagesTable, indicators, weakSignals } from '@olympus/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DEMO_USER_EMAIL = 'demo@stratsight.com.br';
const DEMO_PROJECT_ID = 'sess_demo_msef_2026';

const DEMO_ANALYSIS = `# Análise Estratégica — Cenários para o Setor de Defesa 2030

## Síntese Executiva

O ambiente estratégico brasileiro para a década 2025–2035 é marcado por três vetores de força simultâneos: a aceleração tecnológica (IA, hipervelocidade, guerra eletrônica), a multipolaridade crescente e a pressão sobre o orçamento de defesa. A análise prospectiva MSEF identificou quatro cenários plausíveis para o horizonte 2030.

## Cenários Identificados

### Cenário 1 — Modernização Acelerada (Probabilidade: 35%)
O Brasil consolida parcerias estratégicas com parceiros tecnológicos e avança no SGDC-2, VANT de combate e blindados. A ameaça cibernética cresce, mas a resposta institucional é proporcional. Contexto: crescimento econômico moderado (2–3% a.a.) e estabilidade política.

### Cenário 2 — Statu Quo Pressionado (Probabilidade: 30%)
Restrições orçamentárias persistentes limitam a modernização. Programas estratégicos avançam em velocidade reduzida. O risco é o aumento do gap tecnológico com atores regionais. Contexto: crescimento abaixo de 2%, pressão fiscal elevada.

### Cenário 3 — Parceria Sul-Sul (Probabilidade: 20%)
Aprofundamento da cooperação com parceiros do Sul Global. Transferência de tecnologia em áreas não-sensíveis. Dependência reduzida de fornecedores tradicionais. Contexto: reconfiguração das alianças internacionais.

### Cenário 4 — Crise e Adaptação (Probabilidade: 15%)
Crise econômica severa força cortes profundos. Priorização de capacidades essenciais. Risco de descontinuidade em programas de longa duração. Contexto: recessão, instabilidade regional.

## Variáveis Críticas Monitoradas

- **Orçamento do MD/PIB**: Tendência de queda abaixo de 1,3% — sinal de alerta para Cenários 2 e 4
- **Índice de prontidão operacional**: Estável em 78% — abaixo da meta de 85%
- **Ameaças cibernéticas/mês**: Crescimento de 23% no último trimestre
- **Parcerias industriais ativas**: 14 acordos vigentes, 3 em renegociação

## Recomendações Estratégicas

1. Priorizar o SGDC-2 como projeto âncora independente do cenário
2. Estabelecer gatilho orçamentário: se MD/PIB < 1,2%, acionar Plano de Contingência B
3. Ampliar a capacitação em defesa cibernética (Cenário 3 e 4 convergem nesta necessidade)
4. Revisão semestral dos cenários com dados atualizados do KRATOS

*Análise gerada pelo HERMES — Sistema de Inteligência Estratégica OLYMPUS v4 · StratSight Brasil*`;

async function run() {
  console.log('🎭 Iniciando seed de demonstração (PoC)...');

  // ── Usuário admin de demonstração ──────────────────────────────────────────
  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_USER_EMAIL) });
  let demoUser: any = existing;
  if (!existing) {
    const passwordHash = await bcrypt.hash('OlympusDemo2026!', 10);
    const [u] = await db.insert(users).values({
      name: 'Analista Demo', email: DEMO_USER_EMAIL, passwordHash, role: 'admin',
    }).returning();
    demoUser = u;
    console.log(`✅ Usuário demo criado: ${DEMO_USER_EMAIL} / OlympusDemo2026!`);
  } else {
    console.log(`ℹ️  Usuário demo já existe: ${DEMO_USER_EMAIL}`);
  }

  // ── Projeto de demonstração ────────────────────────────────────────────────
  const existingProj = await db.query.projects.findFirst({ where: eq(projects.id, DEMO_PROJECT_ID) });
  if (!existingProj) {
    await db.insert(projects).values({
      id:               DEMO_PROJECT_ID,
      name:             'Cenários Estratégicos para o Setor de Defesa 2030',
      client:           'CEEx — Centro de Estudos Estratégicos do Exército',
      analyst:          'Analista Demo',
      horizon:          '2030',
      classification:   'Confidencial',
      methodology:      'MSEF',
      status:           'Em produção',
      kratosCron:       '0 8 * * 1',
      alertEmails:      DEMO_USER_EMAIL,
      createdBy:        'seed-demo',
      updatedBy:        'seed-demo',
    });
    console.log(`✅ Projeto demo criado: ${DEMO_PROJECT_ID}`);
  } else {
    console.log(`ℹ️  Projeto demo já existe.`);
  }

  // ── Mensagem de análise pré-carregada ──────────────────────────────────────
  const existingMsg = await db.query.messages.findFirst({ where: eq(messagesTable.projectId, DEMO_PROJECT_ID) });
  if (!existingMsg) {
    await db.insert(messagesTable).values({
      projectId:   DEMO_PROJECT_ID,
      role:        'assistant',
      content:     DEMO_ANALYSIS,
      agentName:   'HERMES_MSEF',
      messageType: 'relatorio_final',
    });
    console.log('✅ Análise MSEF pré-carregada inserida.');
  }

  // ── Indicadores de monitoramento ───────────────────────────────────────────
  const demoIndicators = [
    { name: 'Orçamento MD/PIB (%)',              source: 'IPEA/BCB', status: 'amarelo', lastValue: 1.28,
      parametersJson: { yellowThreshold: 1.3, redThreshold: 1.0 } },
    { name: 'Prontidão Operacional (%)',         source: 'MD',       status: 'amarelo', lastValue: 78,
      parametersJson: { yellowThreshold: 80, redThreshold: 65 } },
    { name: 'Ameaças Cibernéticas/mês',          source: 'CIGE',     status: 'vermelho', lastValue: 1247,
      parametersJson: { yellowThreshold: 800, redThreshold: 1000 } },
    { name: 'Parcerias Industriais Ativas',       source: 'IMBEL',    status: 'verde', lastValue: 14,
      parametersJson: { yellowThreshold: 10, redThreshold: 7 } },
    { name: 'Variação Cambial USD/BRL (%)',       source: 'BCB',      status: 'verde', lastValue: 2.3,
      parametersJson: { yellowThreshold: 8, redThreshold: 15 } },
  ];

  for (const ind of demoIndicators) {
    const exists = await db.query.indicators.findFirst({
      where: eq(indicators.name, ind.name),
    });
    if (!exists) {
      await db.insert(indicators).values({ projectId: DEMO_PROJECT_ID, ...ind, lastCheckedAt: new Date() });
    }
  }
  console.log('✅ Indicadores de monitoramento inseridos.');

  // ── Sinais fracos de exemplo ───────────────────────────────────────────────
  const demoSignals = [
    {
      titulo:      'Aceleração tecnológica em IA militar — China e EUA',
      descricao:   'China e EUA investem acima de US$ 20bi/ano cada em IA para aplicações militares. Brasil sem política estruturada para este domínio.',
      tipo:        'megatendencia' as const,
      classificacao: 'confirmavel' as const,
      statusRadar: 'amplificando' as const,
      acaoRecomendada: 'Elaborar política nacional de IA dual-use. Incluir no PEEx 2028.',
      janelaAnos:  '3–5',
      identificadoPor: 'KLIO',
    },
    {
      titulo:      'Restrição de acesso a semicondutores avançados',
      descricao:   'Controles de exportação dos EUA podem impactar programas que dependem de chips avançados (sistemas de navegação, comunicações seguras).',
      tipo:        'wild_card' as const,
      classificacao: 'ambiguo' as const,
      statusRadar: 'monitorando' as const,
      acaoRecomendada: 'Mapear dependências críticas. Avaliar alternativas europeias e israelenses.',
      janelaAnos:  '1–3',
      identificadoPor: 'KLIO',
    },
    {
      titulo:      'Degradação da segurança na fronteira norte',
      descricao:   'Aumento de 18% nos incidentes na Calha Norte no último semestre. Correlação com expansão de redes criminosas transnacionais.',
      tipo:        'weak_signal' as const,
      classificacao: 'confirmavel' as const,
      statusRadar: 'amplificando' as const,
      acaoRecomendada: 'Intensificar operações de garantia da lei e da ordem. Reforçar pelotões especiais de fronteira.',
      janelaAnos:  '1–2',
      identificadoPor: 'KRATOS',
    },
  ];

  for (const sig of demoSignals) {
    const exists = await db.query.weakSignals.findFirst({
      where: eq(weakSignals.titulo, sig.titulo),
    });
    if (!exists) {
      await db.insert(weakSignals).values({ projectId: DEMO_PROJECT_ID, ...sig });
    }
  }
  console.log('✅ Sinais fracos inseridos.');

  console.log('\n🎉 Seed de demonstração concluído!');
  console.log('─────────────────────────────────────────');
  console.log(`  URL:   http://localhost:8080`);
  console.log(`  Email: ${DEMO_USER_EMAIL}`);
  console.log(`  Senha: OlympusDemo2026!`);
  console.log('─────────────────────────────────────────');
  process.exit(0);
}

run().catch(e => { console.error('❌ Erro no seed-demo:', e); process.exit(1); });
