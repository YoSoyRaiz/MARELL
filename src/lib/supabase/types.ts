// Tipos del schema MARELL — refleja supabase/schema.sql.
// Cuando el schema cambie, regenerar con `supabase gen types typescript` o actualizar a mano.

export type Currency = 'DOP' | 'USD'
export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'investment'
  | 'mortgage'
  | 'other'
export type ClearedStatus = 'uncleared' | 'cleared' | 'reconciled'
export type GoalType =
  | 'savings_balance'
  | 'savings_builder'
  | 'monthly_spending'
  | 'needed_by'
  | 'debt_payoff'
export type Frequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'every2weeks'
  | 'monthly'
  | 'yearly'
export type Plan = 'trial' | 'free' | 'pro'
export type MemberRole = 'owner' | 'editor' | 'viewer'

type Profile = {
  id: string
  display_name: string | null
  plan: Plan
  trial_ends_at: string | null
  pro_expires_at: string | null
  approved: boolean
  onboarded: boolean
  avatar_url: string | null
  updated_at: string
  email_notifications: boolean
  notifications_last_seen: string | null
  // Billing fields — added by migration 2026_05_02_billing.sql
  subscription_provider: 'azul' | 'paypal' | null
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | null
  subscription_external_id: string | null
  subscription_card_token: string | null
  subscription_card_last4: string | null
  subscription_card_brand: string | null
  last_payment_at: string | null
  next_billing_at: string | null
  subscription_canceled_at: string | null
}

type Budget = {
  id: string
  name: string
  currency: Currency
  /** Rate the user has set for converting USD↔DOP across mixed-
      currency accounts. Default 60. Updated via Ajustes. */
  usd_to_dop_rate: number
  created_by: string
  created_at: string
}

type BudgetMember = {
  id: string
  budget_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

type Account = {
  id: string
  budget_id: string
  name: string
  type: AccountType
  currency: Currency
  balance: number
  credit_limit: number | null
  is_budget_account: boolean
  closed: boolean
  sort_order: number
  note: string | null
  created_at: string
}

type CategoryGroup = {
  id: string
  budget_id: string
  name: string
  is_system: boolean
  sort_order: number
  collapsed: boolean
}

type Category = {
  id: string
  group_id: string
  budget_id: string
  name: string
  is_system: boolean
  sort_order: number
  hidden: boolean
  goal_type: GoalType | null
  goal_amount: number | null
  goal_date: string | null
  goal_monthly: number | null
  note: string | null
  created_at: string
}

type MonthlyAssignment = {
  id: string
  budget_id: string
  category_id: string
  month: string
  assigned: number
  note: string | null
}

type Payee = {
  id: string
  budget_id: string
  name: string
  default_category_id: string | null
  created_at: string
}

type Transaction = {
  id: string
  account_id: string
  budget_id: string
  date: string
  payee_id: string | null
  payee_name: string | null
  category_id: string | null
  memo: string | null
  amount: number
  cleared: ClearedStatus
  approved: boolean
  is_split: boolean
  transfer_account_id: string | null
  transfer_transaction_id: string | null
  scheduled_transaction_id: string | null
  import_id: string | null
  // Receipt attachment — added by migration 2026_05_07_receipts.sql.
  // Public URL (signed) for display, plus the bucket path so we can
  // delete the file when the transaction is deleted.
  receipt_url: string | null
  receipt_path: string | null
  created_at: string
}

type Subtransaction = {
  id: string
  transaction_id: string
  category_id: string | null
  payee_id: string | null
  memo: string | null
  amount: number
}

type ScheduledTransaction = {
  id: string
  budget_id: string
  account_id: string
  payee_id: string | null
  payee_name: string | null
  category_id: string | null
  memo: string | null
  amount: number | null
  frequency: Frequency
  next_date: string
  is_split: boolean
  active: boolean
  created_at: string
}

type Table<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

type BudgetInvitation = {
  id: string
  budget_id: string
  invited_by: string
  email: string
  role: MemberRole
  token: string
  accepted_at: string | null
  accepted_by: string | null
  expires_at: string
  created_at: string
}

type PushSubscription = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
  last_seen_at: string
}

type CronRun = {
  id: string
  route: string
  run_date: string
  succeeded: boolean | null
  payload: Record<string, unknown> | null
  created_at: string
}

type PaymentEvent = {
  id: string
  profile_id: string
  provider: 'azul' | 'paypal'
  external_id: string | null
  amount: number
  currency: 'DOP' | 'USD'
  status: 'success' | 'failed' | 'pending' | 'refunded'
  error_message: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>
      budgets: Table<Budget>
      budget_members: Table<BudgetMember>
      accounts: Table<Account>
      category_groups: Table<CategoryGroup>
      categories: Table<Category>
      monthly_assignments: Table<MonthlyAssignment>
      payees: Table<Payee>
      transactions: Table<Transaction>
      subtransactions: Table<Subtransaction>
      scheduled_transactions: Table<ScheduledTransaction>
      budget_invitations: Table<BudgetInvitation>
      payment_events: Table<PaymentEvent>
      cron_runs: Table<CronRun>
      push_subscriptions: Table<PushSubscription>
    }
    Views: Record<string, never>
    Functions: {
      create_default_categories: {
        Args: { p_budget_id: string }
        Returns: void
      }
      is_budget_member: {
        Args: { bid: string }
        Returns: boolean
      }
      delete_my_account: {
        Args: Record<string, never>
        Returns: void
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: Array<{
          id: string
          email: string
          display_name: string | null
          plan: string
          trial_ends_at: string | null
          pro_expires_at: string | null
          approved: boolean
          onboarded: boolean
          signed_up_at: string
          last_sign_in_at: string | null
        }>
      }
      admin_record_payment: {
        Args: { target_id: string; months: number }
        Returns: void
      }
      admin_extend_trial: {
        Args: { target_id: string; days: number }
        Returns: void
      }
      admin_set_approved: {
        Args: { target_id: string; approved: boolean }
        Returns: void
      }
      admin_set_free: {
        Args: { target_id: string }
        Returns: void
      }
      admin_delete_user: {
        Args: { target_id: string }
        Returns: void
      }
    }
    Enums: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
