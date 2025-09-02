export type FacilityType = 'revolving' | 'single_loan';
export type FacilityStatus = 'active' | 'paused' | 'closed';

export type Facility = {
  id: string;
  customer_id: string;
  type: FacilityType;
  status: FacilityStatus;
  credit_limit: number;
  apr: number;
  min_advance: number;
  created_at: string;
};