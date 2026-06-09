/**
 * TechniqueEngine — Motor de Técnicas Analíticas Estruturadas (SAT)
 *
 * Carrega as instruções das técnicas configuradas para um projeto/agente
 * e as injeta no system prompt em tempo de execução.
 *
 * Regra de build: este arquivo fica em apps/api/src/tools/ (não em packages/tools/)
 * porque precisa importar @olympus/db, que só fica disponível após o build do pacote db.
 */

import { db, techniques as techniquesTable } from '@olympus/db';
import { inArray } from 'drizzle-orm';

/**
 * Busca as instruções das técnicas pelo nome e retorna bloco de prompt pronto.
 * Retorna string vazia se não houver técnicas configuradas.
 */
export async function getTechniqueInstructions(techniqueNames: string[]): Promise<string> {
  if (!techniqueNames || techniqueNames.length === 0) return '';

  const techs = await db.query.techniques.findMany({
    where: inArray(techniquesTable.name, techniqueNames),
  });

  if (techs.length === 0) return '';

  const blocks = techs.map(t =>
    `### TÉCNICA: ${t.name}\n**Descrição:** ${t.description}\n\n${t.instructions}`
  ).join('\n\n---\n\n');

  return `\n\n[TÉCNICAS ANALÍTICAS ESTRUTURADAS — APLICAR NESTA ANÁLISE]\nAs seguintes técnicas SAT (Structured Analytic Techniques) devem ser aplicadas conforme descrição abaixo. Execute cada etapa na ordem indicada e registre os resultados no corpo da resposta.\n\n${blocks}`;
}

/**
 * Técnicas NATO AltA para seed — 12 técnicas da Part 2 do Handbook.
 * Retorna array pronto para db.insert(techniques).values([...]).
 */
export function getAltATechniquesForSeed() {
  return [
    {
      name: 'Identificação de Premissas-Chave',
      description: 'Identifica sistematicamente as premissas que sustentam o raciocínio e avalia quais são críticas para a validade da análise.',
      instructions: `PROCESSO (4 etapas):
1. REVISAR O RACIOCÍNIO ATUAL: Documente a linha de argumentação ou hipótese principal da análise.
2. LISTAR TODAS AS PREMISSAS: Identifique todas as suposições — explícitas e implícitas — que devem ser verdadeiras para o raciocínio ser válido. Inclua premissas sobre o ambiente, atores, tendências e dados disponíveis.
3. IDENTIFICAR PREMISSAS-CHAVE: Para cada premissa, pergunte: "Esta premissa PRECISA ser verdadeira para o argumento ser válido?" Classifique como chave (sim) ou não-chave (não). A "premissa-âncora" é aquela cuja falha invalida toda a análise.
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
1. DEFINIR O EVENTO: Descreva com precisão o cenário hipotético a analisar (ex: "O país X entrou em colapso fiscal"). Especifique o estado do mundo se o evento ocorresse.
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
}
