import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface User {
  id: string
  email: string
  full_name: string
  avatar_initials: string
  role: 'member' | 'staff' | 'leads' | 'admin'
  branch_id?: string
  phone?: string
  created_at: string
  is_active: boolean
}

export interface Member {
  id: string
  user_id: string
  branch_id: string
  avatar: string
  phone: string
  email: string
  package_id: string
  status: 'active' | 'expiring' | 'expired'
  sessions_left: number
  total_sessions: number
  join_date: string
  total_paid: number
}

export interface Staff {
  id: string
  user_id: string
  branch_id: string
  avatar: string
  role: string
  status: 'online' | 'offline'
  phone: string
  email: string
  clients_count: number
  rating: number
  total_sessions: number
}

export interface Session {
  id: string
  member_id: string
  staff_id: string
  branch_id: string
  session_type: string
  session_date: string
  start_time: string
  duration_minutes: number
  status: 'done' | 'now' | 'soon' | 'cancelled'
  notes?: string
  rating?: number
}

export interface Transaction {
  id: string
  member_id: string
  package_id?: string
  branch_id: string
  amount: number
  transaction_type: string
  status: 'completed' | 'pending' | 'failed'
  transaction_date: string
}

// ============================================================================
// MEMBERS
// ============================================================================

export async function getMemberByUserId(userId: string) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data as Member
}

export async function getAllMembers(branchId?: string) {
  let query = supabase.from('members').select('*')

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) throw error
  return data as Member[]
}

// ============================================================================
// STAFF
// ============================================================================

export async function getStaffByBranch(branchId: string) {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('branch_id', branchId)

  if (error) throw error
  return data as Staff[]
}

// ============================================================================
// SESSIONS
// ============================================================================

export async function getSessionsByMember(memberId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('member_id', memberId)
    .order('session_date', { ascending: false })

  if (error) throw error
  return data as Session[]
}

export async function getSessionsByStaff(staffId: string, sessionDate?: string) {
  let query = supabase
    .from('sessions')
    .select('*')
    .eq('staff_id', staffId)

  if (sessionDate) {
    query = query.eq('session_date', sessionDate)
  }

  const { data, error } = await query.order('start_time', { ascending: true })

  if (error) throw error
  return data as Session[]
}

export async function createSession(sessionData: Partial<Session>) {
  const { data, error } = await supabase
    .from('sessions')
    .insert([sessionData])
    .select()

  if (error) throw error
  return data[0] as Session
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getTransactionsByMember(memberId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('member_id', memberId)
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data as Transaction[]
}

export async function createTransaction(transactionData: Partial<Transaction>) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transactionData])
    .select()

  if (error) throw error
  return data[0] as Transaction
}
