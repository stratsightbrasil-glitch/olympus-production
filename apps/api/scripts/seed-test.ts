#!/usr/bin/env npx tsx
/**
 * OLYMPUS v4.0 — Seed de Dados para Testes
 * Cria usuários de teste necessários para run-tests.ts
 *
 * Uso: npx tsx scripts/seed-test.ts
 *
 * Cria (idempotente — não duplica):
 *   admin@olympus.test     / AdminTest123!     (role: admin)
 *   analista@olympus.test  / SenhaTest123!     (role: analista)
 *   cliente@olympus.test   / ClienteTest123!   (role: cliente)
 */

import * as crypto from "crypto";

const API = "http://localhost:3333";

async function apiPost(path: string, body: unknown, jwt?: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function getOrCreateAdmin() {
  // Verificar se já existe algum usuário (GET /setup-status → { hasUsers })
  const { body: setupStatus } = await apiGet("/api/v1/auth/setup-status");
  const hasUsers = (setupStatus as { hasUsers?: boolean }).hasUsers;

  if (!hasUsers) {
    // Criar primeiro admin via register
    const { status, body } = await apiPost("/api/v1/auth/register", {
      name: "Admin OLYMPUS Testes",
      email: "admin@olympus.test",
      password: "AdminTest123!",
      role: "admin",
    });
    if (status === 200 || status === 201) {
      console.log("  ✅ Admin criado: admin@olympus.test");
      return (body as { token: string }).token;
    } else {
      throw new Error(`Falha ao criar admin: ${JSON.stringify(body)}`);
    }
  }

  // Login admin existente
  const { status, body } = await apiPost("/api/v1/auth/login", {
    email: "admin@olympus.test",
    password: "AdminTest123!",
  });

  if (status === 200) {
    console.log("  ✅ Admin já existe: admin@olympus.test");
    return (body as { token: string }).token;
  }

  throw new Error(`Admin existe mas login falhou: HTTP ${status} ${JSON.stringify(body)}`);
}

async function ensureUser(
  adminJwt: string,
  email: string,
  name: string,
  password: string,
  role: string
) {
  // Tentar criar via /api/v1/users (admin endpoint)
  const { status, body } = await apiPost("/api/v1/users", {
    name, email, password, role,
  }, adminJwt);

  if (status === 200 || status === 201) {
    console.log(`  ✅ Usuário criado: ${email} (${role})`);
    return;
  }

  // Já existe — verificar se login funciona
  const { status: loginStatus } = await apiPost("/api/v1/auth/login", {
    email, password,
  });

  if (loginStatus === 200) {
    console.log(`  ✓  Usuário já existe: ${email} (${role})`);
  } else {
    console.log(`  ⚠️  Usuário ${email} existe mas login falhou (${loginStatus}) — pode ter senha diferente`);
  }
}

async function main() {
  console.log("\n" + "═".repeat(50));
  console.log("  OLYMPUS v4.0 — Seed de Usuários de Teste");
  console.log("═".repeat(50) + "\n");

  try {
    const adminJwt = await getOrCreateAdmin();

    await ensureUser(adminJwt, "analista@olympus.test", "Analista Testes", "SenhaTest123!", "analista");
    await ensureUser(adminJwt, "cliente@olympus.test", "Cliente Testes", "ClienteTest123!", "cliente");

    console.log("\n  ✅ Seed concluído. Usuários prontos para run-tests.ts\n");
    console.log("  admin@olympus.test    → AdminTest123!");
    console.log("  analista@olympus.test → SenhaTest123!");
    console.log("  cliente@olympus.test  → ClienteTest123!\n");

  } catch (e) {
    console.error("  ❌ Seed falhou:", e);
    console.error("  Verifique: docker compose ps && curl http://localhost:3333/health\n");
    process.exit(1);
  }
}

main();
