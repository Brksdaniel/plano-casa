// Tipos do schema `tracker`, escritos à mão a partir de
// supabase/migrations/20261120000001_tracker_schema.sql.
// O gerador do Supabase via MCP só cobre o schema `public`.
// Ao mudar a migração, atualize este arquivo.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ApartmentStatus =
  | 'ativo'
  | 'possivelmente_alugado'
  | 'indisponivel'
  | 'removido'
  | 'erro_acesso'
  | 'verificacao_necessaria'
  | 'nao_verificado'
export type MonitorMode = 'auto' | 'extension' | 'manual'
export type DataSource = 'server' | 'extension' | 'manual'
export type ConfidenceLevel = 'alta' | 'media' | 'baixa'
export type ChangeKind =
  | 'price_down'
  | 'price_up'
  | 'condo_change'
  | 'iptu_change'
  | 'status_change'
  | 'description_change'
  | 'features_change'
  | 'images_change'

/** Colunas com default/geradas/identity viram opcionais no Insert; geradas não entram. */
type Table<Row, Required extends keyof Row, Generated extends keyof Row = never> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required | Generated>>
  Update: Partial<Omit<Row, Generated>>
  Relationships: []
}

type Profile = { id: string; display_name: string | null; created_at: string }

type UserPreferences = {
  user_id: string
  notify_email: string | null
  email_enabled: boolean
  daily_digest_enabled: boolean
  daily_digest_hour: number
  min_change_abs: number
  min_change_pct: number
  theme: 'light' | 'dark'
  created_at: string
  updated_at: string
}

type Apartment = {
  id: string
  user_id: string
  url_original: string
  url_normalized: string
  platform: string
  external_listing_id: string | null
  custom_name: string | null
  source_title: string | null
  neighborhood: string | null
  city: string | null
  rent: number | null
  condo_fee: number | null
  iptu: number | null
  total_monthly: number
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  area_m2: number | null
  priority: number
  notes: string | null
  main_image_url: string | null
  monitor_mode: MonitorMode
  status: ApartmentStatus
  confidence: ConfidenceLevel | null
  last_check_at: string | null
  last_success_at: string | null
  last_source: DataSource | null
  consecutive_failures: number
  consecutive_not_found: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

type ApartmentSnapshot = {
  id: number
  user_id: string
  apartment_id: string
  checked_at: string
  source: DataSource
  http_status: number | null
  page_kind: 'listing' | 'challenge' | 'not_found' | 'other' | null
  rent: number | null
  condo_fee: number | null
  iptu: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null
  area_m2: number | null
  availability: 'active' | 'explicit_unavailable' | 'unknown' | null
  description_hash: string | null
  images_hash: string | null
  confidence: ConfidenceLevel | null
  raw: Json | null
  error: string | null
}

type ApartmentPriceHistory = {
  id: number
  user_id: string
  apartment_id: string
  recorded_at: string
  rent: number | null
  condo_fee: number | null
  iptu: number | null
  total_monthly: number
  source: DataSource
}

type ApartmentStatusHistory = {
  id: number
  user_id: string
  apartment_id: string
  changed_at: string
  from_status: ApartmentStatus | null
  to_status: ApartmentStatus
  evidence: string | null
  source: DataSource
}

type ApartmentChange = {
  id: number
  user_id: string
  apartment_id: string
  detected_at: string
  kind: ChangeKind
  old_value: string | null
  new_value: string | null
  diff_abs: number | null
  diff_pct: number | null
  dedupe_key: string
}

type Notification = {
  id: number
  user_id: string
  apartment_id: string | null
  change_id: number | null
  kind: string
  title: string
  body: string | null
  read_at: string | null
  emailed_at: string | null
  channel_deliveries: Json
  dedupe_key: string
  created_at: string
}

type MonitoringLog = {
  id: number
  user_id: string | null
  run_id: string
  trigger: 'cron' | 'manual' | 'extension'
  apartment_id: string | null
  platform: string | null
  http_status: number | null
  outcome: string
  error_message: string | null
  duration_ms: number | null
  started_at: string
  finished_at: string | null
}

export type Database = {
  tracker: {
    Tables: {
      profiles: Table<Profile, 'id'>
      user_preferences: Table<UserPreferences, 'user_id'>
      apartments: Table<Apartment, 'user_id' | 'url_original' | 'url_normalized' | 'platform', 'total_monthly'>
      apartment_snapshots: Table<ApartmentSnapshot, 'user_id' | 'apartment_id' | 'source', 'id'>
      apartment_price_history: Table<ApartmentPriceHistory, 'user_id' | 'apartment_id' | 'source', 'id' | 'total_monthly'>
      apartment_status_history: Table<ApartmentStatusHistory, 'user_id' | 'apartment_id' | 'to_status' | 'source', 'id'>
      apartment_changes: Table<ApartmentChange, 'user_id' | 'apartment_id' | 'kind' | 'dedupe_key', 'id'>
      notifications: Table<Notification, 'user_id' | 'kind' | 'title' | 'dedupe_key', 'id'>
      monitoring_logs: Table<MonitoringLog, 'run_id' | 'trigger' | 'outcome', 'id'>
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      apartment_status: ApartmentStatus
      monitor_mode: MonitorMode
      data_source: DataSource
      confidence_level: ConfidenceLevel
      change_kind: ChangeKind
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['tracker']['Tables']> = Database['tracker']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['tracker']['Tables']> = Database['tracker']['Tables'][T]['Insert']
