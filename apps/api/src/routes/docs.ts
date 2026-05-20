import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';

const docsRoutes = new Hono();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OLYMPUS API',
    version: '4.0.0',
    description: 'API do sistema OLYMPUS — Plataforma de Strategic Foresight e Monitoramento Contínuo (StratSight Brasil)',
    contact: { name: 'StratSight Brasil', email: 'stratsightbrasil@gmail.com' },
  },
  servers: [{ url: '/api/v1', description: 'Produção' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth',        description: 'Autenticação JWT e 2FA' },
    { name: 'Sessions',    description: 'Projetos / sessões de análise' },
    { name: 'Chat',        description: 'Motor ATHENA — análise multi-agente' },
    { name: 'Indicators',  description: 'Motor KRATOS — monitoramento de indicadores' },
    { name: 'Embeddings',  description: 'RAG — indexação e busca semântica de documentos' },
    { name: 'Extract',     description: 'Extração de texto de arquivos (PDF, DOCX, XLSX…)' },
    { name: 'Users',       description: 'Gerenciamento de usuários' },
    { name: 'Engine',      description: 'Gerenciamento dinâmico de metodologias e agentes' },
    { name: 'Backup',      description: 'Backup do banco de dados (admin)' },
  ],
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'],
            properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' }, totp: { type: 'string', description: 'Código TOTP (se 2FA ativo)' } } } } },
        },
        responses: {
          200: { description: 'Token JWT', content: { 'application/json': { schema: { type: 'object',
            properties: { token: { type: 'string' }, requiresTwoFactor: { type: 'boolean' } } } } } },
          401: { description: 'Credenciais inválidas' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Registrar novo usuário',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'],
            properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Usuário criado' }, 409: { description: 'E-mail já existe' } },
      },
    },

    // ── Sessions ──────────────────────────────────────────────────────────────
    '/sessions': {
      get: {
        tags: ['Sessions'], summary: 'Listar projetos do usuário',
        responses: { 200: { description: 'Array de projetos' } },
      },
      post: {
        tags: ['Sessions'], summary: 'Criar novo projeto',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object',
            properties: { name: { type: 'string' }, client: { type: 'string' }, methodology: { type: 'string', default: 'MSEF' },
              horizon: { type: 'string' }, analyst: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Projeto criado com id gerado' } },
      },
    },
    '/sessions/{id}': {
      get: {
        tags: ['Sessions'], summary: 'Buscar projeto por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Projeto' }, 404: { description: 'Não encontrado' } },
      },
      patch: {
        tags: ['Sessions'], summary: 'Atualizar projeto',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object',
            properties: { name: { type: 'string' }, status: { type: 'string' }, kratosCron: { type: 'string' }, methodology: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Projeto atualizado' } },
      },
      delete: {
        tags: ['Sessions'], summary: 'Excluir projeto',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Excluído' } },
      },
    },

    // ── Chat ─────────────────────────────────────────────────────────────────
    '/chat': {
      post: {
        tags: ['Chat'], summary: 'Análise síncrona (resposta única)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['message', 'sessionId'],
            properties: { message: { type: 'string' }, sessionId: { type: 'string' },
              methodology: { type: 'string', default: 'MSEF' }, vizMode: { type: 'string', enum: ['etapa', 'passo', 'thinking', 'passagem'] } } } } },
        },
        responses: { 200: { description: 'Resposta do agente HERMES' } },
      },
    },
    '/chat/stream': {
      post: {
        tags: ['Chat'], summary: 'Análise com SSE (streaming de tokens e status)',
        description: 'Retorna Server-Sent Events. Tipos de evento: `status` (agente ativo), `agent` (resposta completa), `token` (delta de token), `done`, `error`.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['message', 'sessionId'],
            properties: { message: { type: 'string' }, sessionId: { type: 'string' }, methodology: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Stream SSE', content: { 'text/event-stream': { schema: { type: 'string' } } } } },
      },
    },

    // ── Indicators ────────────────────────────────────────────────────────────
    '/indicators/project/{projectId}': {
      get: {
        tags: ['Indicators'], summary: 'Listar indicadores de um projeto',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Array de indicadores com status (verde/amarelo/vermelho)' } },
      },
    },
    '/indicators': {
      post: {
        tags: ['Indicators'], summary: 'Criar ou atualizar indicador',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'projectId'],
            properties: { name: { type: 'string' }, projectId: { type: 'string' }, fonte: { type: 'string' },
              status: { type: 'string', enum: ['verde', 'amarelo', 'vermelho'] },
              ultimoValor: { type: 'number' }, limiarAmarelo: { type: 'number' }, limiarVermelho: { type: 'number' } } } } },
        },
        responses: { 200: { description: 'Indicador criado/atualizado' } },
      },
    },

    // ── Embeddings ────────────────────────────────────────────────────────────
    '/embeddings/index': {
      post: {
        tags: ['Embeddings'], summary: 'Indexar texto para RAG',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['projectId', 'text'],
            properties: { projectId: { type: 'string' }, text: { type: 'string' }, filename: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Chunks indexados', content: { 'application/json': { schema: { type: 'object',
          properties: { ok: { type: 'boolean' }, chunks: { type: 'integer' } } } } } },
        },
      },
    },
    '/embeddings/{projectId}': {
      delete: {
        tags: ['Embeddings'], summary: 'Remover todos os embeddings de um projeto',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Removido' } },
      },
    },
    '/embeddings/{projectId}/count': {
      get: {
        tags: ['Embeddings'], summary: 'Contar chunks indexados',
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Contagem', content: { 'application/json': { schema: { type: 'object',
          properties: { count: { type: 'integer' } } } } } } },
      },
    },

    // ── Extract ───────────────────────────────────────────────────────────────
    '/extract': {
      post: {
        tags: ['Extract'], summary: 'Extrair texto de arquivo',
        description: 'Aceita PDF, DOCX, TXT, XLSX/XLS, CSV, JSON, imagens (OCR). Se `projectId` for informado, indexa automaticamente para RAG.',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'],
            properties: { file: { type: 'string', format: 'binary' }, projectId: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Texto extraído', content: { 'application/json': { schema: { type: 'object',
          properties: { text: { type: 'string' }, filename: { type: 'string' } } } } } },
        },
      },
    },

    // ── Users ─────────────────────────────────────────────────────────────────
    '/users': {
      get: { tags: ['Users'], summary: 'Listar usuários (admin)', responses: { 200: { description: 'Array de usuários' } } },
    },
    '/users/{id}': {
      patch: {
        tags: ['Users'], summary: 'Atualizar usuário',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object',
          properties: { name: { type: 'string' }, role: { type: 'string', enum: ['admin', 'analista', 'cliente'] } } } } } },
        responses: { 200: { description: 'Atualizado' } },
      },
      delete: {
        tags: ['Users'], summary: 'Excluir usuário (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Excluído' } },
      },
    },

    // ── Engine ────────────────────────────────────────────────────────────────
    '/engine/methodologies': {
      get: { tags: ['Engine'], summary: 'Listar metodologias disponíveis', responses: { 200: { description: 'Array de metodologias' } } },
      post: { tags: ['Engine'], summary: 'Instalar nova metodologia (motor)', responses: { 201: { description: 'Instalada' } } },
    },
    '/engine/agents': {
      get: { tags: ['Engine'], summary: 'Listar agentes', responses: { 200: { description: 'Array de agentes' } } },
    },

    // ── Backup ────────────────────────────────────────────────────────────────
    '/backup/generate': {
      post: { tags: ['Backup'], summary: 'Gerar backup .sql.gz (admin)', responses: { 200: { description: 'Arquivo gerado' } } },
    },
    '/backup/list': {
      get: { tags: ['Backup'], summary: 'Listar backups disponíveis (admin)', responses: { 200: { description: 'Array de arquivos' } } },
    },
    '/backup/download/{filename}': {
      get: {
        tags: ['Backup'], summary: 'Baixar backup (admin)',
        parameters: [{ name: 'filename', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Arquivo .sql.gz', content: { 'application/gzip': {} } } },
      },
    },
  },
};

// Serve OpenAPI JSON
docsRoutes.get('/openapi.json', (c) => c.json(openApiSpec));

// Serve Swagger UI
docsRoutes.get('/', swaggerUI({ url: '/api/docs/openapi.json' }));

export default docsRoutes;
