import { Tool } from '@olympus/core';

// ─── BCB (SGS) ────────────────────────────────────────────────────────────────
const BCB_SERIES: Record<string, { codigo: number; nome: string; unidade: string }> = {
  selic:          { codigo: 11,    nome: 'Taxa SELIC',                           unidade: '% a.a.' },
  cdi:            { codigo: 12,    nome: 'CDI',                                  unidade: '% a.a.' },
  ipca:           { codigo: 433,   nome: 'IPCA (variação mensal)',               unidade: '%' },
  ipca_12m:       { codigo: 13522, nome: 'IPCA acumulado 12 meses',             unidade: '%' },
  igpm:           { codigo: 189,   nome: 'IGP-M (variação mensal)',              unidade: '%' },
  cambio_venda:   { codigo: 1,     nome: 'Câmbio USD/BRL (venda)',               unidade: 'R$' },
  cambio_compra:  { codigo: 10813, nome: 'Câmbio EUR/BRL (venda)',               unidade: 'R$' },
  reservas:       { codigo: 3546,  nome: 'Reservas Internacionais',              unidade: 'US$ bi' },
  divida_pib:     { codigo: 4503,  nome: 'Dívida Líquida do Setor Público/PIB', unidade: '%' },
  credito_pib:    { codigo: 20626, nome: 'Crédito Total/PIB',                   unidade: '%' },
  ibc_br:         { codigo: 24363, nome: 'IBC-Br (proxy PIB mensal)',            unidade: 'índice' },
};

// ─── IBGE ─────────────────────────────────────────────────────────────────────
const IBGE_SERIES: Record<string, { agregado: number; variavel: number; nome: string; unidade: string }> = {
  desemprego: { agregado: 6381, variavel: 4099, nome: 'Taxa de Desocupação (PNAD Contínua)', unidade: '%' },
  pib_tri:    { agregado: 1621, variavel: 583,  nome: 'PIB — Variação Trimestral',           unidade: '%' },
  pib_anual:  { agregado: 2072, variavel: 93,   nome: 'PIB — Variação Anual',                unidade: '%' },
};

// ─── IPEA Data (OData v4) ─────────────────────────────────────────────────────
const IPEA_SERIES: Record<string, { codigo: string; nome: string; unidade: string }> = {
  divida_bruta:   { codigo: 'FINPUB_DBGG',      nome: 'Dívida Bruta do Governo Geral',         unidade: '% PIB' },
  tjlp:           { codigo: 'BM_TJLP',           nome: 'TJLP — Taxa de Juros de Longo Prazo',  unidade: '% a.a.' },
  divida_externa: { codigo: 'BM_EEDT',            nome: 'Dívida Externa Total Bruta',           unidade: 'US$ mi' },
  igpdi:          { codigo: 'PRECOS12_IGPDI12',  nome: 'IGP-DI (variação mensal)',              unidade: '%' },
  fbkf:           { codigo: 'SCN_FBKFN10',       nome: 'Formação Bruta de Capital Fixo',        unidade: '% PIB' },
};

// ─── World Bank (Indicators API v2) ──────────────────────────────────────────
// country: ISO3 (ex: BRA, USA, ARG). World Bank accepts ISO3 directly.
const WB_SERIES: Record<string, { id: string; nome: string; unidade: string }> = {
  wb_pib:            { id: 'NY.GDP.MKTP.CD',       nome: 'PIB nominal (WB)',              unidade: 'US$' },
  wb_crescimento:    { id: 'NY.GDP.MKTP.KD.ZG',    nome: 'Crescimento do PIB (WB)',       unidade: '% a.a.' },
  wb_inflacao_wb:    { id: 'FP.CPI.TOTL.ZG',       nome: 'Inflação CPI (WB)',             unidade: '% a.a.' },
  wb_conta_corrente: { id: 'BN.CAB.XOKA.GD.ZS',   nome: 'Conta Corrente (WB)',           unidade: '% PIB' },
  wb_divida_central: { id: 'GC.DOD.TOTL.GD.ZS',   nome: 'Dívida Gov. Central (WB)',      unidade: '% PIB' },
  wb_fdi:            { id: 'BX.KLT.DINV.WD.GD.ZS', nome: 'IDE líquido (WB)',             unidade: '% PIB' },
  wb_desemprego:     { id: 'SL.UEM.TOTL.ZS',       nome: 'Desemprego total (WB)',         unidade: '%' },
  wb_populacao:      { id: 'SP.POP.TOTL',           nome: 'População total (WB)',          unidade: 'hab.' },
  wb_gini:           { id: 'SI.POV.GINI',           nome: 'Índice de Gini (WB)',           unidade: '0–100' },
  wb_exportacoes:    { id: 'NE.EXP.GNFS.ZS',       nome: 'Exportações bens/serviços (WB)', unidade: '% PIB' },
  wb_importacoes:    { id: 'NE.IMP.GNFS.ZS',       nome: 'Importações bens/serviços (WB)', unidade: '% PIB' },
};

// ─── IMF DataMapper (WEO forecasts) ──────────────────────────────────────────
// country: IMF ISO3 (BRA, USA, ARG, etc.)
const IMF_SERIES: Record<string, { id: string; nome: string; unidade: string }> = {
  imf_crescimento:    { id: 'NGDP_RPCH',    nome: 'PIB real (crescimento FMI)',      unidade: '%' },
  imf_inflacao:       { id: 'PCPIPCH',      nome: 'Inflação preços consumidor (FMI)', unidade: '%' },
  imf_conta_corrente: { id: 'BCA_NGDPD',   nome: 'Conta corrente (FMI)',             unidade: '% PIB' },
  imf_divida_publica: { id: 'GGXWDG_NGDP', nome: 'Dívida bruta governo geral (FMI)', unidade: '% PIB' },
  imf_desemprego:     { id: 'LUR',          nome: 'Desemprego (FMI)',                 unidade: '%' },
  imf_saldo_fiscal:   { id: 'GGXCNL_NGDP', nome: 'Resultado fiscal líquido (FMI)',   unidade: '% PIB' },
};

// ─── WHO GHO (OData v4 via ghoapi.azureedge.net) ────────────────────────────
// country: ISO3 (BRA, USA, etc.)
const WHO_SERIES: Record<string, { id: string; dim1?: string; nome: string; unidade: string }> = {
  who_expectativa_vida:    { id: 'WHOSIS_000001',   dim1: 'BTSX', nome: 'Expectativa de vida ao nascer (OMS)', unidade: 'anos' },
  who_mortalidade_infantil:{ id: 'MDG_0000000001',              nome: 'Mortalidade infantil <5 anos (OMS)',   unidade: 'por 1.000 NV' },
  who_mortalidade_materna: { id: 'MDG_0000000025',              nome: 'Mortalidade materna (OMS)',            unidade: 'por 100.000 NV' },
  who_cobertura_vacinas:   { id: 'WHS8_110',                    nome: 'Cobertura DTP3 (OMS)',                 unidade: '%' },
};

// ─── UN Population (UNDESA Population Division API) ─────────────────────────
// Numeric location codes for key countries
const UN_LOCATION_CODES: Record<string, number> = {
  BRA: 76, USA: 840, CHN: 156, RUS: 643, IND: 356, ARG: 32,
  COL: 170, MEX: 484, PER: 604, CHL: 152, VEN: 862, URY: 858,
  DEU: 276, FRA: 250, GBR: 826, ESP: 724, ITA: 380, JPN: 392,
  ZAF: 710, NGA: 566, EGY: 818,
};
const UN_SERIES: Record<string, { indicatorId: number; nome: string; unidade: string }> = {
  un_populacao:    { indicatorId: 49, nome: 'População total (ONU)',      unidade: 'milhares' },
  un_crescimento:  { indicatorId: 47, nome: 'Crescimento populacional (ONU)', unidade: '% a.a.' },
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchBcb(codigo: number): Promise<string> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/3?formato=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`BCB HTTP ${res.status}`);
  const data: Array<{ data: string; valor: string }> = await res.json();
  return data.map(d => `${d.data}: ${d.valor}`).join(' | ');
}

async function fetchIbge(agregado: number, variavel: number): Promise<string> {
  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${agregado}/periodos/last%201/variaveis/${variavel}?localidades=N1[all]`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`IBGE HTTP ${res.status}`);
  const data: any[] = await res.json();
  const resultado = data[0]?.resultados?.[0]?.series?.[0]?.serie;
  if (!resultado) return '(sem dados)';
  return Object.entries(resultado).map(([per, val]) => `${per}: ${val}`).join(' | ');
}

async function fetchIpea(codigo: string): Promise<string> {
  const url = `http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${codigo}')?$top=3&$orderby=VALDATA desc&$select=VALDATA,VALVALOR`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`IPEA HTTP ${res.status}`);
  const data: any = await res.json();
  const values: Array<{ VALDATA: string; VALVALOR: number | null }> = data.value ?? [];
  if (values.length === 0) return '(sem dados)';
  return values.map(v => {
    const mes = v.VALDATA.slice(0, 7);
    const val = v.VALVALOR !== null ? v.VALVALOR : '—';
    return `${mes}: ${val}`;
  }).join(' | ');
}

async function fetchComexStat(flow: 'EXP' | 'IMP'): Promise<string> {
  const now = new Date();
  const ref = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const periodo = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
  const body = {
    flow, monthDetail: false,
    period: { from: `${ref.getFullYear()}-01`, to: periodo },
    filters: [], details: [], metrics: ['metricFOB'],
  };
  const res = await fetch('https://api.comexstat.mdic.gov.br/general', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`ComexStat HTTP ${res.status}`);
  const data: any = await res.json();
  const list: any[] = data?.data?.list ?? data?.list ?? [];
  if (list.length === 0) return '(sem dados)';
  const total = list.reduce((acc: number, row: any) => acc + (Number(row.metricFOB) || 0), 0);
  const label = flow === 'EXP' ? 'Exportações' : 'Importações';
  return `${label} FOB jan–${ref.toLocaleString('pt-BR', { month: 'short' })}/${ref.getFullYear()}: US$ ${(total / 1e9).toFixed(2)} bi`;
}

async function fetchWorldBank(indicatorId: string, country: string): Promise<string> {
  // World Bank accepts ISO3 directly
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicatorId}?format=json&mrv=5&per_page=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`World Bank HTTP ${res.status}`);
  const data: any = await res.json();
  const values: any[] = data?.[1] ?? [];
  if (values.length === 0) return '(sem dados)';
  return values
    .filter(v => v.value !== null)
    .slice(0, 3)
    .map(v => `${v.date}: ${typeof v.value === 'number' ? v.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : v.value}`)
    .join(' | ') || '(sem dados recentes)';
}

async function fetchImf(indicatorId: string, country: string): Promise<string> {
  const now = new Date();
  const years = [-2, -1, 0, 1, 2].map(d => now.getFullYear() + d).join(',');
  const url = `https://www.imf.org/external/datamapper/api/v1/${indicatorId}?periods=${years}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`IMF HTTP ${res.status}`);
  const data: any = await res.json();
  const countryData: Record<string, number | null> = data?.values?.[indicatorId]?.[country] ?? {};
  if (Object.keys(countryData).length === 0) return '(sem dados)';
  return Object.entries(countryData)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([yr, val]) => {
      const suffix = Number(yr) > now.getFullYear() ? '*' : ''; // * = previsão
      return `${yr}${suffix}: ${val !== null ? val?.toFixed(2) : '—'}`;
    })
    .join(' | ');
}

async function fetchWho(indicatorId: string, country: string, dim1?: string): Promise<string> {
  let filter = `SpatialDim eq '${country}'`;
  if (dim1) filter += ` and Dim1 eq '${dim1}'`;
  const url = `https://ghoapi.azureedge.net/api/${indicatorId}?$filter=${encodeURIComponent(filter)}&$orderby=TimeDim desc&$top=3`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`WHO GHO HTTP ${res.status}`);
  const data: any = await res.json();
  const values: any[] = data?.value ?? [];
  if (values.length === 0) return '(sem dados)';
  return values
    .map(v => `${v.TimeDim}: ${v.NumericValue !== null ? Number(v.NumericValue).toFixed(1) : (v.Value ?? '—')}`)
    .join(' | ');
}

async function fetchUnPopulation(indicatorId: number, country: string): Promise<string> {
  const locCode = UN_LOCATION_CODES[country];
  if (!locCode) return `(código ONU não mapeado para "${country}" — disponível: ${Object.keys(UN_LOCATION_CODES).join(', ')})`;
  const now = new Date().getFullYear();
  const url = `https://population.un.org/dataportalapi/api/v1/indicators/${indicatorId}/locations/${locCode}/start/${now - 3}/end/${now + 2}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`UN Population HTTP ${res.status}`);
  const data: any = await res.json();
  const values: any[] = data?.data ?? [];
  if (values.length === 0) return '(sem dados)';
  return values
    .slice(0, 4)
    .map(v => `${v.timeLabel ?? v.year}: ${v.value !== null ? Number(v.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}`)
    .join(' | ');
}

// ─── IBGE Países ─────────────────────────────────────────────────────────────
const ISO3_TO_ISO2: Record<string, string> = {
  BRA: 'BR', USA: 'US', ARG: 'AR', COL: 'CO', MEX: 'MX',
  PER: 'PE', CHL: 'CL', VEN: 'VE', URY: 'UY', BOL: 'BO',
  PRY: 'PY', ECU: 'EC', CUB: 'CU', PAN: 'PA', CRI: 'CR',
  GTM: 'GT', HND: 'HN', SLV: 'SV', NIC: 'NI', DOM: 'DO',
  DEU: 'DE', FRA: 'FR', GBR: 'GB', ESP: 'ES', ITA: 'IT',
  PRT: 'PT', NLD: 'NL', BEL: 'BE', CHE: 'CH', AUT: 'AT',
  SWE: 'SE', NOR: 'NO', DNK: 'DK', FIN: 'FI', POL: 'PL',
  RUS: 'RU', UKR: 'UA', TUR: 'TR', GRC: 'GR', CZE: 'CZ',
  CHN: 'CN', IND: 'IN', JPN: 'JP', KOR: 'KR', IDN: 'ID',
  PAK: 'PK', BGD: 'BD', VNM: 'VN', THA: 'TH', MYS: 'MY',
  PHL: 'PH', SGP: 'SG', ISR: 'IL', SAU: 'SA', ARE: 'AE',
  IRN: 'IR', IRQ: 'IQ', EGY: 'EG', ZAF: 'ZA', NGA: 'NG',
  ETH: 'ET', KEN: 'KE', GHA: 'GH', AGO: 'AO', MOZ: 'MZ',
  CAN: 'CA', AUS: 'AU', NZL: 'NZ',
};

async function fetchIbgePaisPerfil(country: string): Promise<string> {
  const iso2 = ISO3_TO_ISO2[country] ?? country;
  const url = `https://servicodados.ibge.gov.br/api/v1/paises/${iso2}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`IBGE Países HTTP ${res.status}`);
  const data: any = await res.json();
  const p = Array.isArray(data) ? data[0] : data;
  if (!p) return '(sem dados)';
  const parts: string[] = [];
  if (p.nome) parts.push(`Nome: ${p.nome}`);
  if (p.area?.total) parts.push(`Área: ${Number(p.area.total).toLocaleString('pt-BR')} km²`);
  if (p.capital) parts.push(`Capital: ${p.capital}`);
  if (p.regiao) parts.push(`Região: ${p.regiao}`);
  if (p.idioma) parts.push(`Idioma: ${Array.isArray(p.idioma) ? p.idioma.join(', ') : p.idioma}`);
  if (p.moeda) parts.push(`Moeda: ${p.moeda}`);
  if (p.populacao) parts.push(`Pop.: ${Number(p.populacao).toLocaleString('pt-BR')}`);
  return parts.join(' | ') || JSON.stringify(p).slice(0, 300);
}

async function fetchIbgePaisIndicador(country: string, indicadorId: number): Promise<string> {
  const iso2 = ISO3_TO_ISO2[country] ?? country;
  const url = `https://servicodados.ibge.gov.br/api/v1/paises/${iso2}/indicadores/${indicadorId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`IBGE Países indicador HTTP ${res.status}`);
  const data: any = await res.json();
  const arr: any[] = Array.isArray(data) ? data : [data];
  if (arr.length === 0) return '(sem dados)';
  const item = arr[0];
  const serie: Record<string, any> = item?.series?.[0]?.serie ?? item?.serie ?? {};
  const entries = Object.entries(serie)
    .filter(([, v]) => v !== null && v !== '')
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 4);
  if (entries.length === 0) return '(sem dados recentes)';
  return entries.map(([yr, val]) => `${yr}: ${val}`).join(' | ');
}

const IBGE_PAISES_SERIES: Record<string, { indicadorId: number; nome: string; unidade: string }> = {
  ibge_turistas:   { indicadorId: 77818, nome: 'Chegadas de turistas internacionais (IBGE/Países)', unidade: 'mil' },
  ibge_educacao:   { indicadorId: 77819, nome: 'Gasto público em educação (IBGE/Países)',           unidade: '% PIB' },
};

// ─── ITU DataHub ──────────────────────────────────────────────────────────────
let _ituToken: string | null = null;
let _ituTokenTs = 0;

async function getItuToken(): Promise<string> {
  const email = process.env.ITU_EMAIL;
  const password = process.env.ITU_PASSWORD;
  if (!email || !password) throw new Error('ITU_EMAIL e ITU_PASSWORD não configurados (datahub.itu.int — gratuito).');
  if (_ituToken && Date.now() - _ituTokenTs < 6 * 3600 * 1000) return _ituToken;
  const res = await fetch('https://api.datahub.itu.int/v2/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ITU login HTTP ${res.status}`);
  const body: any = await res.json();
  const token = body.token ?? body.jwt ?? body.access_token ?? body.data?.token;
  if (!token) throw new Error('ITU: resposta sem token — verifique credenciais.');
  _ituToken = token;
  _ituTokenTs = Date.now();
  return token;
}

async function fetchItu(indicatorCode: string, country: string): Promise<string> {
  const token = await getItuToken();
  const iso2 = ISO3_TO_ISO2[country] ?? country;
  const url = `https://api.datahub.itu.int/v2/data/download/byid/${indicatorCode}?format=json&filterbycountry=${iso2}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ITU DataHub HTTP ${res.status}`);
  const data: any = await res.json();
  // ITU response structure: {data: [{year, value}, ...]} or [{year, value}] or {value: [...]}
  const rows: any[] = data?.data ?? (Array.isArray(data) ? data : data?.value ?? []);
  const filtered = rows.filter((r: any) => r.value !== null && r.value !== '');
  if (filtered.length === 0) return '(sem dados)';
  return filtered
    .sort((a: any, b: any) => (b.year ?? b.Year ?? 0) - (a.year ?? a.Year ?? 0))
    .slice(0, 4)
    .map((r: any) => {
      const yr = r.year ?? r.Year ?? r.timePeriod ?? '?';
      const val = r.value ?? r.Value ?? r.obsValue ?? '?';
      return `${yr}: ${typeof val === 'number' ? val.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : val}`;
    })
    .join(' | ');
}

const ITU_SERIES: Record<string, { code: string; nome: string; unidade: string }> = {
  itu_internet:     { code: 'i_inet',    nome: 'Usuários de internet (ITU)',          unidade: '% pop.' },
  itu_celular:      { code: 'i_mob',     nome: 'Assinantes celular (ITU)',            unidade: 'por 100 hab.' },
  itu_banda_larga:  { code: 'i_fbband',  nome: 'Banda larga fixa (ITU)',              unidade: 'por 100 hab.' },
  itu_movel_bb:     { code: 'i_mband',   nome: 'Banda larga móvel (ITU)',             unidade: 'por 100 hab.' },
  itu_idi:          { code: 'ii_idi',    nome: 'ICT Development Index (ITU)',         unidade: 'índice 0–10' },
};

// ─── DOU via inlabs.in.gov.br ────────────────────────────────────────────────
let _inlabsToken: string | null = null;
let _inlabsTokenTs = 0;

async function getInlabsToken(): Promise<string> {
  const email = process.env.INLABS_EMAIL;
  const senha = process.env.INLABS_PASSWORD;
  if (!email || !senha) throw new Error('INLABS_EMAIL e INLABS_PASSWORD não configurados (inlabs.in.gov.br — gratuito).');
  if (_inlabsToken && Date.now() - _inlabsTokenTs < 6 * 3600 * 1000) return _inlabsToken;
  const res = await fetch('https://inlabs.in.gov.br/logar.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `email=${encodeURIComponent(email)}&senha=${encodeURIComponent(senha)}`,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`INLABS login HTTP ${res.status}`);
  const body: any = await res.json();
  const token = body.token ?? body.jwt ?? body.access_token;
  if (!token) throw new Error('INLABS: resposta sem token — verifique credenciais.');
  _inlabsToken = token;
  _inlabsTokenTs = Date.now();
  return token;
}

async function fetchDOU(termo: string): Promise<string> {
  const token = await getInlabsToken();
  const linhas: string[] = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const edicao = dt.toISOString().slice(0, 10);
    const url = `https://inlabs.in.gov.br/index.php?jwt=${encodeURIComponent(token)}&edicao=${edicao}&secao=do1&formato=json`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (res.status === 404) continue;
      if (!res.ok) continue;
      const data: any = await res.json();
      const atos: any[] = Array.isArray(data) ? data : data?.atos ?? data?.items ?? [];
      const filtrado = atos.filter((a: any) => {
        const txt = `${a.titulo ?? ''} ${a.ementa ?? ''} ${a.identifica ?? ''}`.toLowerCase();
        return txt.includes(termo.toLowerCase());
      });
      for (const a of filtrado.slice(0, 3)) {
        linhas.push(`[${edicao}] ${a.titulo ?? a.identifica ?? '(sem título)'} — ${(a.ementa ?? '').slice(0, 120)}`);
      }
      if (linhas.length >= 5) break;
    } catch { continue; }
  }
  if (linhas.length === 0) return `(nenhum ato encontrado no DOU para "${termo}" nos últimos 7 dias)`;
  return linhas.join('\n');
}

// ─── Tool definition ──────────────────────────────────────────────────────────
export type DadosPublicosArgs = {
  indicadores: string[];
  pais?: string;      // ISO3 (BRA, USA, ARG...) para indicadores internacionais. Padrão: BRA
  termo_dou?: string;
};

const ALL_INDICATORS = [
  // BCB/SGS
  'selic', 'cdi', 'ipca', 'ipca_12m', 'igpm',
  'cambio_venda', 'cambio_compra', 'reservas',
  'divida_pib', 'credito_pib', 'ibc_br',
  // IBGE
  'desemprego', 'pib_tri', 'pib_anual',
  // IPEA Data
  'divida_bruta', 'tjlp', 'divida_externa', 'igpdi', 'fbkf',
  // Comex Stat
  'exportacoes', 'importacoes', 'balanca_comercial',
  // World Bank
  'wb_pib', 'wb_crescimento', 'wb_inflacao_wb', 'wb_conta_corrente',
  'wb_divida_central', 'wb_fdi', 'wb_desemprego', 'wb_populacao', 'wb_gini',
  'wb_exportacoes', 'wb_importacoes',
  // IMF DataMapper (WEO)
  'imf_crescimento', 'imf_inflacao', 'imf_conta_corrente',
  'imf_divida_publica', 'imf_desemprego', 'imf_saldo_fiscal',
  // WHO GHO
  'who_expectativa_vida', 'who_mortalidade_infantil',
  'who_mortalidade_materna', 'who_cobertura_vacinas',
  // UN Population
  'un_populacao', 'un_crescimento',
  // IBGE Países
  'ibge_pais_perfil', 'ibge_turistas', 'ibge_educacao',
  // ITU DataHub
  'itu_internet', 'itu_celular', 'itu_banda_larga', 'itu_movel_bb', 'itu_idi',
];

export const dadosPublicosTool: Tool<DadosPublicosArgs> = {
  name: 'buscar_dados_publicos',
  description: `Busca indicadores macroeconômicos, sociais e financeiros em APIs oficiais nacionais e internacionais, além de atos normativos do Diário Oficial da União.

FONTES NACIONAIS (Brasil):
• BCB/SGS: selic, cdi, ipca, ipca_12m, igpm, cambio_venda, cambio_compra, reservas, divida_pib, credito_pib, ibc_br
• IBGE: desemprego, pib_tri, pib_anual
• IPEA Data: divida_bruta, tjlp, divida_externa, igpdi, fbkf
• Comex Stat (MDic): exportacoes, importacoes, balanca_comercial
• DOU Seção 1 (INLABS): use termo_dou para buscar atos normativos recentes

FONTES INTERNACIONAIS (use parâmetro "pais" com ISO3, padrão BRA):
• Banco Mundial (WB): wb_pib, wb_crescimento, wb_inflacao_wb, wb_conta_corrente, wb_divida_central, wb_fdi, wb_desemprego, wb_populacao, wb_gini, wb_exportacoes, wb_importacoes
• FMI/WEO (inclui previsões marcadas com *): imf_crescimento, imf_inflacao, imf_conta_corrente, imf_divida_publica, imf_desemprego, imf_saldo_fiscal
• OMS/WHO (GHO): who_expectativa_vida, who_mortalidade_infantil, who_mortalidade_materna, who_cobertura_vacinas
• ONU Population: un_populacao, un_crescimento
• IBGE Países: ibge_pais_perfil, ibge_turistas, ibge_educacao
• ITU DataHub: itu_internet, itu_celular, itu_banda_larga, itu_movel_bb, itu_idi

Países disponíveis para ONU: BRA, USA, CHN, RUS, IND, ARG, COL, MEX, PER, CHL, DEU, FRA, GBR, ESP, ITA, JPN, ZAF.
Países disponíveis para IBGE Países/ITU: BRA, USA, ARG, COL, MEX, DEU, FRA, GBR, ESP, ITA, CHN, IND, JPN, ZAF e outros (ISO3).`,
  schema: {
    type: 'object',
    properties: {
      indicadores: {
        type: 'array',
        items: { type: 'string', enum: ALL_INDICATORS },
        description: 'Lista de indicadores desejados. Máximo 6 por chamada.',
        maxItems: 6,
      },
      pais: {
        type: 'string',
        description: 'Código ISO3 do país para indicadores internacionais (WB, FMI, OMS, ONU). Padrão: BRA (Brasil). Exemplos: USA, ARG, COL, MEX, CHN.',
        default: 'BRA',
      },
      termo_dou: {
        type: 'string',
        description: 'Termo de busca no Diário Oficial da União (Seção 1), últimos 7 dias úteis. Opcional.',
      },
    },
    required: ['indicadores'],
  } as any,

  execute: async (args: DadosPublicosArgs, _context: any) => {
    const pais = (args.pais ?? 'BRA').toUpperCase();
    const linhas: string[] = [`[DADOS OFICIAIS — BCB · IBGE · IPEA · COMEX · WB · FMI · OMS · ONU · IBGE-PAÍSES · ITU · DOU | país: ${pais}]`];

    // ── Indicadores ──────────────────────────────────────────────────────────
    if (args.indicadores?.length > 0) {
      console.log(`[DadosPublicos] Buscando: ${args.indicadores.join(', ')} | pais=${pais}`);
      const tasks = args.indicadores.slice(0, 6).map(async (ind): Promise<string> => {
        // ── Nacionais ──
        if (BCB_SERIES[ind]) {
          const s = BCB_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [BCB]: ${await fetchBcb(s.codigo)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        if (IBGE_SERIES[ind]) {
          const s = IBGE_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [IBGE]: ${await fetchIbge(s.agregado, s.variavel)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        if (IPEA_SERIES[ind]) {
          const s = IPEA_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [IPEA]: ${await fetchIpea(s.codigo)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        if (ind === 'exportacoes' || ind === 'balanca_comercial') {
          try {
            const exp = await fetchComexStat('EXP');
            if (ind === 'exportacoes') return `• ${exp} [Comex Stat]`;
            const imp = await fetchComexStat('IMP');
            const expVal = parseFloat(exp.match(/US\$ ([\d.]+) bi/)?.[1] ?? '0');
            const impVal = parseFloat(imp.match(/US\$ ([\d.]+) bi/)?.[1] ?? '0');
            return `• Balança Comercial YTD: US$ ${(expVal - impVal).toFixed(2)} bi (${exp.split(':')[1]?.trim()} | ${imp.split(':')[1]?.trim()}) [Comex Stat]`;
          } catch (e: any) { return `• Comex Stat: indisponível (${e.message})`; }
        }
        if (ind === 'importacoes') {
          try { return `• ${await fetchComexStat('IMP')} [Comex Stat]`; }
          catch (e: any) { return `• Importações: indisponível (${e.message})`; }
        }
        // ── Banco Mundial ──
        if (WB_SERIES[ind]) {
          const s = WB_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [WB/${pais}]: ${await fetchWorldBank(s.id, pais)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        // ── FMI DataMapper ──
        if (IMF_SERIES[ind]) {
          const s = IMF_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [FMI/${pais}]: ${await fetchImf(s.id, pais)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        // ── WHO GHO ──
        if (WHO_SERIES[ind]) {
          const s = WHO_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [OMS/${pais}]: ${await fetchWho(s.id, pais, s.dim1)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        // ── UN Population ──
        if (UN_SERIES[ind]) {
          const s = UN_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [ONU/${pais}]: ${await fetchUnPopulation(s.indicatorId, pais)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        // ── IBGE Países ──
        if (ind === 'ibge_pais_perfil') {
          try { return `• Perfil do país [IBGE Países/${pais}]: ${await fetchIbgePaisPerfil(pais)}`; }
          catch (e: any) { return `• Perfil do país (IBGE Países): indisponível (${e.message})`; }
        }
        if (IBGE_PAISES_SERIES[ind]) {
          const s = IBGE_PAISES_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [IBGE Países/${pais}]: ${await fetchIbgePaisIndicador(pais, s.indicadorId)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        // ── ITU DataHub ──
        if (ITU_SERIES[ind]) {
          const s = ITU_SERIES[ind];
          try { return `• ${s.nome} (${s.unidade}) [ITU/${pais}]: ${await fetchItu(s.code, pais)}`; }
          catch (e: any) { return `• ${s.nome}: indisponível (${e.message})`; }
        }
        return `• "${ind}": indicador não reconhecido.`;
      });

      const resultados = await Promise.allSettled(tasks);
      resultados.forEach(r => {
        linhas.push(r.status === 'fulfilled' ? r.value : `• Erro: ${(r as any).reason}`);
      });
    }

    // ── DOU ──────────────────────────────────────────────────────────────────
    if (args.termo_dou?.trim()) {
      linhas.push(`\n[DOU — SEÇÃO 1 — busca: "${args.termo_dou}"]`);
      try { linhas.push(await fetchDOU(args.termo_dou.trim())); }
      catch (e: any) { linhas.push(`⚠️ ${e.message}`); }
    }

    linhas.push('\nFontes: api.bcb.gov.br · ibge.gov.br · ipeadata.gov.br · comexstat.mdic.gov.br · api.worldbank.org · imf.org/datamapper · ghoapi.azureedge.net · population.un.org · servicodados.ibge.gov.br/paises · api.datahub.itu.int · inlabs.in.gov.br');
    const resultado = linhas.join('\n');
    console.log(`[DadosPublicos] ✅ Concluído.`);
    return resultado;
  },
};
