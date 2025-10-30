import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await getServerSupabase()
  // Reset usage for clients whose cycle starts today
  const { error } = await supabase
    .from('clients')
    .update({ hours_used_month: 0, cycle_start: new Date().toISOString().slice(0,10) })
    .lte('cycle_start', new Date().toISOString().slice(0,10))

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}


