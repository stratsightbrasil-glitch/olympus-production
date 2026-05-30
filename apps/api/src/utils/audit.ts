/**
 * audit.ts — Log de auditoria com hash-chain SHA-256
 *
 * Cada registro inclui:
 *   metadata._hash         = SHA-256(userId|action|createdAt|previousHash)
 *   metadata._previousHash = hash do registro anterior do mesmo userId
 *
 * A cadeia permite detectar adulterações offline: se qualquer registro for
 * alterado ou removido, os hashes subsequentes não validarão.
 * Hash-chain armazenado no JSONB metadata (sem migração de schema).
 */
import { db, auditLogs } from '@olympus/db';
import { desc, eq } from 'drizzle-orm';
import crypto from 'crypto';

export type AuditAction =
  | 'login' | 'logout'
  | 'create_project' | 'delete_project'
  | 'run_analysis'
  | 'export_docx' | 'export_pdf' | 'export_playbook'
  | 'generate_backup'
  | 'view_painel'
  | 'update_settings'
  | 'create_user' | 'update_user' | 'delete_user';

/** Retorna o hash do último registro do userId (ou 'GENESIS' se não houver). */
async function getPreviousHash(userId: string | undefined): Promise<string> {
  if (!userId) return 'GENESIS';
  try {
    const last = await db
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    const meta = last[0]?.metadata as Record<string, any> | null;
    return meta?._hash ?? 'GENESIS';
  } catch {
    return 'GENESIS';
  }
}

/** Calcula SHA-256(userId|action|createdAt|previousHash). */
function computeHash(
  userId: string | undefined,
  action: string,
  createdAt: string,
  previousHash: string,
): string {
  const payload = `${userId ?? ''}|${action}|${createdAt}|${previousHash}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function logAudit(opts: {
  userId?: string;
  userName?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const createdAt = new Date().toISOString();
    const previousHash = await getPreviousHash(opts.userId);
    const hash = computeHash(opts.userId, opts.action, createdAt, previousHash);

    await db.insert(auditLogs).values({
      userId:       opts.userId,
      userName:     opts.userName,
      action:       opts.action,
      resourceType: opts.resourceType,
      resourceId:   opts.resourceId,
      // _createdAt persiste o timestamp JS exato usado no hash — necessário para verificação.
      // Sem isso, recomputar o hash a partir do DB createdAt (defaultNow) seria impossível.
      metadata:     { ...(opts.metadata ?? {}), _hash: hash, _previousHash: previousHash, _createdAt: createdAt },
      ipAddress:    opts.ipAddress,
    });
  } catch {
    // Falha silenciosa — audit não pode derrubar o fluxo principal
  }
}

/** Recomputa e valida o hash de um registro de auditoria.
 *  Retorna true se o hash armazenado bate com o recomputado. */
export function verifyAuditHash(log: {
  userId: string | null;
  action: string;
  metadata: Record<string, any> | null;
}): boolean {
  const meta = log.metadata as Record<string, any> | null;
  if (!meta?._hash || !meta?._previousHash || !meta?._createdAt) return false;
  const expected = computeHash(log.userId ?? undefined, log.action, meta._createdAt, meta._previousHash);
  return expected === meta._hash;
}
