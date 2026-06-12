import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// We use the Service Role Key so it has permission to update the database
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // 1. Read the "envelope" that QStash sent us
    const body = await request.json()
    const matchId = body.matchId

    if (!matchId) {
      return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })
    }

    console.log(`Turning Match ${matchId} to LIVE...`)

    // 2. Update the specific match in Supabase
    const { error } = await supabase
      .from('matches')
      .update({ status: 'LIVE' })
      .eq('match_id', matchId)
      .eq('is_finished', false) // Safety check so we don't reopen finished matches

    if (error) throw error

    return NextResponse.json({ success: true, matchId, status: 'LIVE' }, { status: 200 })

  } catch (error: any) {
    console.error('Error setting match live:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}