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
    // Ensure user record exists with role='client' if not admin/pm
    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // If user record doesn't exist, create it with role='client'
    if (!userRecord) {
      await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          role: 'client', // Default role is 'client', not 'user'
        })
    }

    // Check if user is admin/pm (from users.role)
    if (userRecord && (userRecord.role === 'admin' || userRecord.role === 'pm')) {
      return NextResponse.redirect(`${origin}/admin/dashboard`)
    }

    // Fallback to client_members check for admin/pm
    const { data: membership } = await supabase
      .from('client_members')
      .select('role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membership && (membership.role === 'admin' || membership.role === 'pm')) {
      return NextResponse.redirect(`${origin}/admin/dashboard`)
    }

    // Check if user has any client membership
    if (!membership) {
      // No client membership - redirect to onboarding
      // User has role='client' but needs to complete onboarding
      return NextResponse.redirect(`${origin}/onboarding`)
    }

    // Regular client user with membership - redirect to client dashboard
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Not authenticated - redirect to login
  return NextResponse.redirect(`${origin}/login`)
}

