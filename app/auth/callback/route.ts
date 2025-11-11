import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServerSupabase } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
  }

  // Check user role and redirect accordingly
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check users.role first
    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userRecord && (userRecord.role === 'admin' || userRecord.role === 'pm')) {
      return NextResponse.redirect(`${origin}/admin/dashboard`)
    }

    // Fallback to client_members check
    const { data: membership } = await supabase
      .from('client_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership && (membership.role === 'admin' || membership.role === 'pm')) {
      return NextResponse.redirect(`${origin}/admin/dashboard`)
    }
  }

  // Redirect to dashboard after successful authentication
  return NextResponse.redirect(`${origin}/dashboard`)
}

