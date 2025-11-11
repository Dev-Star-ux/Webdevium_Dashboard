import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    plan_code: z.string().min(1).optional(),
    hours_monthly: z.number().int().positive().optional(),
    cycle_start: z.string().optional(),
    hours_used_month: z.number().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  })

async function assertIsAdmin() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401 as const, error: 'Unauthorized' }
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from('client_members')
    .select('role')
    .eq('user_id', user.id)

  if (membershipsError) {
    return { ok: false, status: 500 as const, error: membershipsError.message }
  }

  const isAdminOrPM = memberships?.some((m) => m.role === 'admin' || m.role === 'pm')
  if (!isAdminOrPM) {
    return { ok: false, status: 403 as const, error: 'Forbidden' }
  }

  return { ok: true as const }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await assertIsAdmin()
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const clientId = params.id
  const payload = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const adminSupabase = getAdminSupabase()
  const { data, error } = await adminSupabase
    .from('clients')
    .update({
      ...parsed.data,
    })
    .eq('id', clientId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ client: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await assertIsAdmin()
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const clientId = params.id
  const adminSupabase = getAdminSupabase()
  const { error } = await adminSupabase.from('clients').delete().eq('id', clientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}


