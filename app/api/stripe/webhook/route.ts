import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

const Stripe = require('stripe')

export const runtime = 'nodejs'

const PRICE_TO_PLAN: Record<string, { plan_code: string; hours: number }> = {
  price_starter: { plan_code: 'starter', hours: 40 },
  price_growth: { plan_code: 'growth', hours: 80 },
  price_scale: { plan_code: 'scale', hours: 120 },
  price_dedicated: { plan_code: 'dedicated', hours: 160 }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') as string
  const raw = await req.text()

  // Initialize Stripe client inside the function to avoid build-time errors
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

  let event: any
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
  }

  const supabase = await getServerSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerId = session.customer
        const priceId = session.metadata?.price_id
        if (!priceId) break
        const plan = PRICE_TO_PLAN[priceId]
        if (!plan) break

        const name = session.client_reference_id || session.customer_details?.name || 'New Client'
        await supabase.from('clients').insert({
          name,
          stripe_customer_id: customerId,
          plan_code: plan.plan_code,
          hours_monthly: plan.hours,
          cycle_start: new Date().toISOString().slice(0, 10)
        })
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined
        if (!plan) break
        await supabase
          .from('clients')
          .update({ plan_code: plan.plan_code, hours_monthly: plan.hours })
          .eq('stripe_customer_id', sub.customer)
        break
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object
        await supabase
          .from('clients')
          .update({ cycle_start: new Date().toISOString().slice(0, 10), hours_used_month: 0 })
          .eq('stripe_customer_id', inv.customer)
        break
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}


