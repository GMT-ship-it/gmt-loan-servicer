// Portfolio Management Dashboard - Calculation Engine
// Implements simple interest accrual and ROI calculations

export interface CapitalEvent {
  id: string;
  project_id: string;
  provider_id: string;
  event_date: string;
  event_type: 'funding_in' | 'interest_payment_out' | 'principal_payment_out' | 'expense_out' | 'adjustment';
  amount: number;
  interest_flag: boolean;
  interest_rate_override: number | null;
  memo: string | null;
}

export interface CapitalProvider {
  id: string;
  name: string;
  type: 'lender' | 'investor';
  default_interest_rate: number;
}

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  sale_value_assumption: number;
  commission_rate: number;
}

export interface LedgerEntry {
  event_date: string;
  event_type: string;
  amount: number;
  rate_used: number;
  interest_accrued: number;
  running_balance: number;
  memo: string | null;
}

export interface ProviderSummary {
  provider_id: string;
  provider_name: string;
  capital_deployed: number;
  interest_earned: number;
  balance_owed: number;
  roi_simple: number;
}

export interface LiquidationResult {
  asset_name: string;
  sale_value: number;
  commission_rate: number;
  commission_amount: number;
  net_proceeds: number;
}

export interface ProviderPayoff {
  provider_name: string;
  balance_owed: number;
  percent_of_total: number;
  paid_in_liquidation: number;
}

// Calculate days between two dates
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate simple interest accrued
function calculateInterest(principal: number, rate: number, days: number): number {
  if (days <= 0 || principal <= 0) return 0;
  return principal * rate * (days / 365);
}

// Build ledger for a provider
export function buildProviderLedger(
  events: CapitalEvent[],
  provider: CapitalProvider,
  asOfDate: string
): { ledger: LedgerEntry[]; summary: ProviderSummary } {
  // Filter and sort events for this provider up to asOfDate
  const providerEvents = events
    .filter(e => e.provider_id === provider.id && e.event_date <= asOfDate)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const ledger: LedgerEntry[] = [];
  let balance = 0;
  let capitalDeployed = 0;
  let interestEarned = 0;
  let lastDate: string | null = null;

  for (const event of providerEvents) {
    const rate = event.interest_rate_override ?? provider.default_interest_rate;
    
    // Calculate interest since last event (if interest accrues)
    let interestAccrued = 0;
    if (lastDate && event.interest_flag && balance > 0) {
      const days = daysBetween(lastDate, event.event_date);
      interestAccrued = calculateInterest(balance, rate, days);
      interestEarned += interestAccrued;
      balance += interestAccrued;
    }

    // Process the event
    switch (event.event_type) {
      case 'funding_in':
        balance += event.amount;
        capitalDeployed += event.amount;
        break;
      case 'interest_payment_out':
        balance -= event.amount;
        break;
      case 'principal_payment_out':
        balance -= event.amount;
        break;
      case 'expense_out':
        balance += event.amount; // Expense adds to what's owed
        break;
      case 'adjustment':
        balance += event.amount; // Can be positive or negative
        break;
    }

    ledger.push({
      event_date: event.event_date,
      event_type: event.event_type,
      amount: event.amount,
      rate_used: rate,
      interest_accrued: interestAccrued,
      running_balance: Math.max(0, balance),
      memo: event.memo,
    });

    lastDate = event.event_date;
  }

  // Accrue interest from last event to asOfDate
  if (lastDate && balance > 0) {
    const days = daysBetween(lastDate, asOfDate);
    if (days > 0) {
      const rate = provider.default_interest_rate;
      const finalInterest = calculateInterest(balance, rate, days);
      interestEarned += finalInterest;
      balance += finalInterest;
    }
  }

  const roi = capitalDeployed > 0 ? interestEarned / capitalDeployed : 0;

  return {
    ledger,
    summary: {
      provider_id: provider.id,
      provider_name: provider.name,
      capital_deployed: capitalDeployed,
      interest_earned: interestEarned,
      balance_owed: Math.max(0, balance),
      roi_simple: roi,
    },
  };
}

// Calculate all provider summaries
export function calculateAllProviderSummaries(
  events: CapitalEvent[],
  providers: CapitalProvider[],
  asOfDate: string
): ProviderSummary[] {
  return providers.map(provider => {
    const { summary } = buildProviderLedger(events, provider, asOfDate);
    return summary;
  });
}

// Calculate portfolio totals
export function calculatePortfolioTotals(summaries: ProviderSummary[]) {
  return summaries.reduce(
    (acc, s) => ({
      totalCapitalDeployed: acc.totalCapitalDeployed + s.capital_deployed,
      totalInterestEarned: acc.totalInterestEarned + s.interest_earned,
      totalBalanceOwed: acc.totalBalanceOwed + s.balance_owed,
    }),
    { totalCapitalDeployed: 0, totalInterestEarned: 0, totalBalanceOwed: 0 }
  );
}

// Calculate liquidation scenario
export function calculateLiquidation(
  assets: Asset[],
  providerSummaries: ProviderSummary[]
): {
  assetResults: LiquidationResult[];
  totalNetProceeds: number;
  totalNotesOwed: number;
  residualCash: number;
  providerPayoffs: ProviderPayoff[];
} {
  // Calculate asset liquidation
  const assetResults: LiquidationResult[] = assets.map(asset => {
    const commissionAmount = asset.sale_value_assumption * asset.commission_rate;
    return {
      asset_name: asset.name,
      sale_value: asset.sale_value_assumption,
      commission_rate: asset.commission_rate,
      commission_amount: commissionAmount,
      net_proceeds: asset.sale_value_assumption - commissionAmount,
    };
  });

  const totalNetProceeds = assetResults.reduce((sum, a) => sum + a.net_proceeds, 0);
  const totalNotesOwed = providerSummaries.reduce((sum, p) => sum + p.balance_owed, 0);
  const residualCash = totalNetProceeds - totalNotesOwed;

  // Calculate provider payoffs
  const providerPayoffs: ProviderPayoff[] = providerSummaries.map(p => {
    const percentOfTotal = totalNotesOwed > 0 ? p.balance_owed / totalNotesOwed : 0;
    let paidInLiquidation = p.balance_owed;
    
    // If insufficient funds, prorate
    if (totalNetProceeds < totalNotesOwed) {
      paidInLiquidation = totalNetProceeds * percentOfTotal;
    }

    return {
      provider_name: p.provider_name,
      balance_owed: p.balance_owed,
      percent_of_total: percentOfTotal,
      paid_in_liquidation: paidInLiquidation,
    };
  });

  return {
    assetResults,
    totalNetProceeds,
    totalNotesOwed,
    residualCash,
    providerPayoffs,
  };
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format percentage
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
