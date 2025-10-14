# SummitLine LMS - Go-Live Checklist

## ✅ Completed (via migration)

- [x] **Storage buckets created**: `loan-documents` (private), `statements` (private)
- [x] **RLS policies set**: Lenders have full access, borrowers can only view their own statements
- [x] **Performance indexes**: All high-traffic tables indexed for production load
- [x] **Non-accrual safety**: Daily accrual job now explicitly skips non-accrual loans

## 1. Environment & Secrets

### Front-end (already configured)
- `VITE_SUPABASE_URL`: https://ogmrcygjqqugcwzaioxc.supabase.co
- `VITE_SUPABASE_ANON_KEY`: (already set in client.ts)

### Edge Functions (set in Supabase dashboard)
- `SUPABASE_SERVICE_ROLE_KEY`: Set via Supabase Functions secrets
- `LOVABLE_GATEWAY_URL`: (if using external integrations)
- `LOVABLE_GATEWAY_KEY`: (if using external integrations)

### Authentication Setup
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider (already enabled)
3. Optional: Enable **Magic Link** for passwordless login
4. Optional: Enable **Multi-Factor Authentication (MFA)**
5. **Lock CORS**: Authentication → URL Configuration → Add your production domain

## 2. RLS & Security Verification

### Quick RLS Check
Run this query in Supabase SQL Editor:

```sql
-- Check RLS status on all tables
SELECT * FROM public.check_rls_status() 
WHERE rls_enabled = false;

-- Should return 0 rows (all tables have RLS)
```

### Cross-Tenant Leak Test
Test with a borrower JWT to ensure no data leakage:

```sql
-- Try accessing another borrower's data
-- Should return 0 rows
SELECT * FROM payments WHERE loan_id = '<some_other_loan_id>';
SELECT * FROM statements WHERE loan_id = '<some_other_loan_id>';
SELECT * FROM loan_documents WHERE loan_id = '<some_other_loan_id>';
```

## 3. Cron Jobs Verification

Confirm all scheduled jobs are active:

```sql
-- List all cron jobs
SELECT jobid, schedule, command, active 
FROM cron.job 
ORDER BY jobid;
```

Expected jobs:
- **02:00**: `loan-daily-accrual` - Accrue interest daily
- **02:10**: `assess-late-fees-daily` - Assess late fees
- **02:20**: `sync-assessed-fees-paid` - Sync fee payment status (optional)

## 4. Statement Generation Test

1. Navigate to `/admin/loans/:id`
2. Click "Generate Prior-Month Statement"
3. Verify PDF is created in `statements` bucket
4. Confirm borrower can access their statement via `/borrower`

## 5. Seed Data & Migration Plan

### Create Production Organization
```sql
-- Create Mountain Investments org
INSERT INTO organizations (name) 
VALUES ('Mountain Investments')
RETURNING id;

-- Create admin users (adjust email/metadata)
-- Use Supabase Dashboard → Authentication → Add User
```

### Demo Borrower Setup
1. Create a test borrower in the admin panel
2. Create a small loan ($10,000) to verify end-to-end flow
3. Test payment processing and statement generation

### Importing Real Loans
1. **Import borrowers** first
2. **Import loans** with principal/rate/terms
3. **Generate schedules** for each loan
4. **Post opening balances** via adjustments if needed
5. **Upload historical documents** to `loan-documents` bucket
6. **Backfill payments** to reconstruct payment history
7. **Run accrual**: `SELECT public.run_daily_interest_accrual()`

## 6. Backups & Rollback

### Automated Backups
- Confirm daily backups in Supabase Dashboard → Settings → Database
- Minimum: Daily backups
- Recommended: Point-in-time recovery (PITR) enabled

### Manual Backup
```bash
# Export full database dump
pg_dump -h db.<project-ref>.supabase.co -U postgres postgres > backup_$(date +%Y%m%d).sql
```

### Rollback Plan
If critical issues occur:
1. Restore from most recent backup
2. Re-apply migrations from version control
3. Verify data integrity post-restore

## 7. Monitoring & Logs

### Enable Log Drains
- Supabase Dashboard → Settings → Log Drains
- Send to: Datadog, Logtail, or custom endpoint

### Error Tracking
- App already has ErrorBoundary component
- Failed RPCs are logged to console
- Consider adding Sentry for production error tracking

### Key Metrics to Monitor
- Dashboard load time (target: <1.5s)
- Borrower portal load time (target: <1s)
- CSV export time (target: <5s)
- Cron job execution (daily at 02:00, 02:10, 02:20)

## 8. Performance Smoke Tests

With 1,000+ journal entries & 500+ payments:
- [ ] Admin dashboard loads < 1.5s
- [ ] Borrower portal loads < 1s
- [ ] Export CSV (last month) < 5s
- [ ] Loan detail page loads < 2s

If performance is slow, consider:
- Server-side CSV generation via Edge Function
- Pagination on portfolio dashboard
- Additional database indexes

## 9. Privacy & PII

### Verify Data Isolation
- [ ] Borrowers cannot access other borrowers' files
- [ ] RLS on `loan_documents` prevents cross-access
- [ ] RLS on `statements` prevents cross-access
- [ ] RLS on `escrow_transactions` prevents cross-access

### Data Retention Policy
Define internal policy for:
- Closed loans: Retention period (e.g., 7 years)
- Charged-off loans: Archive or purge timeline
- Object storage: Set lifecycle rules in Supabase

## 10. Go-Live Runbook

### Daily Operations
1. **Check KPIs**: Review dashboard for 90+ day delinquencies
2. **Verify Cron Jobs**: Confirm new `journal_entries` for daily accruals
3. **Review Late Fees**: Check Late Fees panel for new assessments
4. **Monitor Notifications**: Check for covenant breaches or system alerts

### Monthly Operations
1. **Generate Statements**: Ensure all active loans have month-end statements
2. **Review Escrow Accounts**: Check for shortages and send borrower notices
3. **Portfolio Review**: Run portfolio dashboard, review utilization and risk

### Common Operations

#### Record Payment
1. Go to `/admin/loans/:id`
2. Click "Post Payment"
3. Enter amount and date
4. Payment waterfall applies automatically (fees → interest → principal)

#### Adjust Balance
1. Go to `/admin/loans/:id`
2. Navigate to "Adjustments" panel
3. Select adjustment type (principal, interest, fee, escrow)
4. Enter amount and memo

#### Waive Late Fee
1. Go to "Late Fees" panel in loan detail
2. Click "Waive" on the fee
3. Confirm waiver (reverses fee in journal)

#### Post Escrow Disbursement
1. Go to "Escrow" panel in loan detail
2. Click "Post Disbursement"
3. Enter negative amount (e.g., -1500 for $1,500 disbursement)
4. Add memo (e.g., "Property tax payment")

#### Charge-Off Loan
1. Go to loan detail
2. Navigate to "Charge-Off" card
3. Select charge-off date
4. Click "Charge-Off"
5. Confirms: Stops accruals, moves balances to charge-off accounts

#### Generate Payoff Letter
1. Borrower can request via `/borrower` → "Payoff Letter"
2. Admin can verify via SQL:
   ```sql
   SELECT public.payoff_quote('<loan_id>', CURRENT_DATE);
   ```

## 11. Security Best Practices

- [ ] All admin accounts use strong passwords
- [ ] MFA enabled for admin users
- [ ] Email confirmations enabled for new sign-ups
- [ ] Production domain locked in Supabase CORS settings
- [ ] Service role key never exposed to client-side code
- [ ] All sensitive operations require authentication
- [ ] RLS policies tested with different user roles

## 12. Final Checklist

- [ ] Environment variables set for production
- [ ] Storage buckets created and private
- [ ] RLS verified on all tables
- [ ] Performance indexes created
- [ ] Cron jobs active and tested
- [ ] Statement generation working
- [ ] Seed data loaded
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Privacy/PII controls verified
- [ ] Runbook reviewed and printed
- [ ] Team trained on daily operations

---

## Support & Troubleshooting

### Common Issues

**Q: Borrower can't see their statements**
- Verify RLS policy on `storage.objects` for `statements` bucket
- Check that statement files are named with loan ID in path

**Q: Cron jobs not running**
- Check `cron.job` table for `active = true`
- Verify `pg_cron` and `pg_net` extensions are enabled
- Check Edge Function logs in Supabase Dashboard

**Q: Payment waterfall not applying correctly**
- Verify `apply_payment_waterfall` function is being triggered
- Check that payment status is 'succeeded'
- Review `journal_entries` for correct allocation

**Q: Performance issues with large datasets**
- Verify all indexes are created (see migration)
- Consider adding pagination to large lists
- Use server-side CSV generation for exports

### Contact Information
- **Technical Support**: [Your Support Email]
- **Emergency Contact**: [On-Call Phone]
- **Supabase Dashboard**: https://supabase.com/dashboard/project/ogmrcygjqqugcwzaioxc

---

**Last Updated**: {{ date }}
**Version**: 1.0
