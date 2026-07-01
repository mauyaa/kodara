// Kodara domain types

// Demo types for UI (denormalized for easy display)
export type PaymentDemo = {
  id: string | number;
  tenant?: string;
  unit?: string;
  amount?: number;
  due_date?: string;
  paid_date?: string | null;
  status:
    "paid" | "pending" | "overdue" | "initiated" | "processing" | "completed";
  mpesa_reference?: string | null;
  mpesa_receipt?: string | null;
  created_at?: string;
};

export type MaintenanceDemo = {
  id: string | number;
  tenant: string;
  unit: string;
  category: string;
  title?: string;
  description: string;
  status:
    | "submitted"
    | "in_review"
    | "approved"
    | "assigned"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "rejected";
  created_at: string;
  updated_at?: string;
};

export type DemoTenantData = {
  name: string;
  unit: string;
  balance: number;
  dueDate: string;
  property: string;
};

export type Role =
  | "landlord"
  | "property_manager"
  | "property_agent"
  | "tenant"
  | "vendor"
  | "admin_staff";

export type KodaraUser = {
  id: string;
  full_name: string;
  phone: string;
  role: Role;
};

export type TenantView = Tenant & {
  full_name: string;
  phone: string;
  unit_name: string;
  property_name: string;
};

export type PaymentView = Payment & {
  tenant_name: string;
  unit_name: string;
  property_name: string;
  due_date: string;
};

export type MaintenanceView = MaintenanceRequest & {
  tenant_name: string;
  unit_name: string;
  property_name: string;
  category_name: string;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  receiver_name: string;
  subject: string | null;
  content: string;
  attachments: string[];
  read: boolean;
  created_at: string;
};

export type DocumentRecord = {
  id: string;
  name: string;
  type: "lease" | "receipt" | "inspection" | "identity" | "other";
  property_id: string | null;
  tenant_id: string | null;
  file_url: string | null;
  size_bytes: number;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  registration_number: string | null;
  kra_pin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  subscription_tier: "free" | "basic" | "pro" | "enterprise";
  subscription_expires_at: string | null;
  mpesa_paybill_number: string | null;
  mpesa_till_number: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  phone: string;
  email: string | null;
  full_name: string | null;
  national_id: string | null;
  role: Role;
  permissions: Record<string, unknown>;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Property = {
  id: string;
  organization_id: string;
  landlord_id: string | null;
  name: string;
  address: string;
  county: string | null;
  town: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: "apartment" | "flat" | "house" | "commercial" | "land";
  total_units: number;
  year_built: number | null;
  amenities: string[] | null;
  photos: string[] | null;
  documents: Record<string, unknown> | null;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  property_id: string;
  unit_name: string;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  monthly_rent: number;
  deposit_amount: number;
  service_charge_monthly: number;
  status: "vacant" | "occupied" | "maintenance" | "reserved";
  occupied_from: string | null;
  occupied_until: string | null;
  utilities_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Lease = {
  id: string;
  unit_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  lease_type: "fixed" | "periodic" | "month_to_month";
  rent_amount: number;
  deposit_paid: number;
  terms: string | null;
  document_url: string | null;
  status: "active" | "terminated" | "expired" | "pending";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Tenant = {
  id: string;
  user_id: string;
  unit_id: string;
  lease_id: string;
  move_in_date: string;
  move_out_date: string | null;
  status: "active" | "moved_out" | "evicted";
  outstanding_balance: number;
  last_payment_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  organization_id: string;
  tenant_id: string;
  unit_id: string;
  invoice_number: string;
  type:
    "rent" | "deposit" | "service_charge" | "late_fee" | "utilities" | "other";
  amount: number;
  tax_amount: number;
  total_amount: number;
  due_date: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  status:
    "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
  description: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  invoice_id: string | null;
  organization_id: string;
  tenant_id: string;
  unit_id: string;
  amount: number;
  payment_method:
    | "mpesa_stk"
    | "mpesa_paybill"
    | "bank_transfer"
    | "cash"
    | "cheque"
    | "card";
  reference: string | null;
  mpesa_receipt: string | null;
  mpesa_sender_phone: string | null;
  mpesa_shortcode: string | null;
  status:
    | "initiated"
    | "processing"
    | "completed"
    | "failed"
    | "reversed"
    | "cancelled";
  failure_reason: string | null;
  processed_at: string | null;
  callback_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceCategory = {
  id: string;
  organization_id: string | null;
  name: string;
  default_responsibility: "landlord" | "tenant" | "shared";
  created_at: string;
};

export type MaintenanceVendor = {
  id: string;
  organization_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  service_category: string | null;
  hourly_rate: number | null;
  rating: number;
  completed_jobs: number;
  created_at: string;
};

export type MaintenanceRequest = {
  id: string;
  organization_id: string;
  unit_id: string;
  tenant_id: string;
  category_id: string | null;
  vendor_id: string | null;
  title: string;
  description: string;
  photos: string[] | null;
  priority: "low" | "medium" | "high" | "emergency";
  status:
    | "submitted"
    | "in_review"
    | "approved"
    | "assigned"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "rejected";
  cost_estimate: number | null;
  actual_cost: number | null;
  scheduled_date: string | null;
  completed_date: string | null;
  tenant_responsibility: boolean;
  tenant_cost: number | null;
  landlord_cost: number | null;
  status_updates: Array<{ status: string; at: string; by: string }>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  organization_id: string;
  recipient_id: string;
  type:
    | "payment_due"
    | "payment_received"
    | "payment_reminder"
    | "maintenance_update"
    | "maintenance_request"
    | "lease_expiry"
    | "vacancy_alert"
    | "system_alert";
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  sent_via: ("app" | "sms" | "email" | "whatsapp")[];
  created_at: string;
};

export type STKPushRequest = {
  phone: string;
  amount: number;
  invoiceId: string;
  accountReference?: string;
  transactionDesc?: string;
};

export type STKCallback = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: Array<{
      Name: string;
      Value: string | number;
    }>;
  };
};

export type ChartOfAccount = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  subtype: string | null;
  is_system: boolean;
  created_at: string;
};

export type AuditLog = {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};
