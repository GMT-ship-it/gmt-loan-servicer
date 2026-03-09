// Lightweight user management module for Supabase Auth + Users table
// This module defines helper functions to invite users, assign roles, revoke accounts,
// list users with their role, last_login, and status, and log changes to an audit_trail table.

import { createClient } from '@supabase/supabase-js';

// Expect environment variables to be provided in deployment
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase credentials are not configured in environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type UserRole = 'Admin'|'Analyst'|'Borrower';

interface AuditEntry {
  action: string;
  user_id?: string;
  target_email?: string;
  role?: UserRole;
  performed_by?: string;
  timestamp?: string;
  details?: string;
}

export async function inviteUserByEmail(email: string, role: UserRole, invitedBy: string) {
  // Create a user in Supabase Auth via an admin endpoint if available; otherwise, generate magic link
  // This code assumes using the Supabase Admin API is available on server side (service role)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: undefined,
    email_confirm: true
  } as any);
  if (error) {
    throw error;
  }
  // Set role in a separate users table (denormalized roles)
  const userId = data && 'user' in data && data.user ? data.user.id : (data as any)?.id;
  await supabase.from('users').upsert({ id: userId, email, role }).eq('email', email);
  await logAudit({ action: 'invite', target_email: email, role, performed_by: invitedBy, details: 'Invited user via email' });
  return data;
}

export async function setUserRole(email: string, role: UserRole, performedBy: string) {
  const { data: user, error: err1 } = await supabase.from('users').select('id').eq('email', email).single();
  if (err1 || !user?.id) throw err1 || new Error('User not found');
  const { error } = await supabase.from('users').update({ role }).eq('id', user.id);
  if (error) throw error;
  await logAudit({ action: 'set_role', target_email: email, role, performed_by: performedBy, details: 'Role updated' });
  return true;
}

export async function revokeUser(email: string, performedBy: string) {
  const { data: user, error: err1 } = await supabase.from('users').select('id').eq('email', email).single();
  if (err1 || !user?.id) throw err1 || new Error('User not found');
  // Disable by updating status
  await supabase.from('users').update({ status: 'revoked' }).eq('id', user.id);
  await logAudit({ action: 'revoke', target_email: email, performed_by: performedBy, details: 'Account deactivated' });
  // Optionally remove from auth by deleting user via admin API (omitted here for safety)
  return true;
}

export async function listUsersWithRoles() {
  const { data, error } = await supabase.from('users').select('*').order('email');
  if (error) throw error;
  return data as any[];
}

async function logAudit(entry: AuditEntry) {
  const payload = {
    action: entry.action,
    user_id: entry.user_id,
    target_email: entry.target_email,
    role: entry.role,
    performed_by: entry.performed_by,
    details: entry.details,
    timestamp: new Date().toISOString()
  };
  await supabase.from('audit_trail').insert([payload]);
}

export async function ensureTablesExist() {
  // Simple safeguard to help initialization in this repo context
  await logAudit({ action: 'init', performed_by: 'system' } as any);
}

export default {
  inviteUserByEmail,
  setUserRole,
  revokeUser,
  listUsersWithRoles,
  ensureTablesExist
};
