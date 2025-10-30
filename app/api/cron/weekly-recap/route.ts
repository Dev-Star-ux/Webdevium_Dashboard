import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await getServerSupabase()

  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name')

  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 400 })

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const summaries: Array<{ client_id: string; total_hours: number; count: number }> = []

  for (const c of clients || []) {
    const { data: logs, error: logsErr } = await supabase
      .from('usage_logs')
      .select('hours, logged_at, task_id')
      .eq('client_id', c.id)
      .gte('logged_at', sinceIso)
      .order('logged_at', { ascending: false })

    if (logsErr) continue

    const total = (logs || []).reduce((sum, row) => sum + Number(row.hours), 0)

    summaries.push({ client_id: c.id, total_hours: total, count: (logs || []).length })
  }

  return NextResponse.json({ ok: true, summaries })
}


