import { supabase } from '@/integrations/supabase/client';

export type ApprovalRequestType =
  | 'disbursement'
  | 'payment_received'
  | 'interest_payment'
  | 'principal_payment'
  | 'adjustment'
  | 'write_off'
  | 'transfer';

export interface CreateApprovalParams {
  entity_id: string;
  request_type: ApprovalRequestType;
  amount: number;
  reason?: string;
  payload: Record<string, any>;
}

/**
 * Creates a pending approval request instead of directly posting to the ledger.
 * Returns the approval request id on success.
 */
export async function createApprovalRequest(params: CreateApprovalParams): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gmt_approval_requests')
    .insert({
      entity_id: params.entity_id,
      request_type: params.request_type as string,
      amount: params.amount,
      requested_by: user.id,
      reason: params.reason || null,
      payload: params.payload,
    } as any)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
