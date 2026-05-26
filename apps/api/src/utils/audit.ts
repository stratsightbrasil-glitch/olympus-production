import { db, auditLogs } from '@olympus/db';

export type AuditAction =
  | 'login' | 'logout'
  | 'create_project' | 'delete_project'
  | 'run_analysis'
  | 'export_docx' | 'export_pdf' | 'export_playbook'
  | 'generate_backup'
  | 'view_painel'
  | 'update_settings'
  | 'create_user' | 'update_user' | 'delete_user';

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
    await db.insert(auditLogs).values({
      userId:       opts.userId,
      userName:     opts.userName,
      action:       opts.action,
      resourceType: opts.resourceType,
      resourceId:   opts.resourceId,
      metadata:     opts.metadata,
      ipAddress:    opts.ipAddress,
    });
  } catch {
    // Falha silenciosa — audit não pode derrubar o fluxo principal
  }
}
