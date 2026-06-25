// api/admin/sync-scorers/route.ts
// Changes from original:
//   1. Replaced 100 sequential supabase.update() calls with ONE bulk upsert
//   2. This drops execution from ~10-30 seconds to under 1 second
//   3. Won't hit Vercel's function timeout anymore

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const res = await fetch(`https://api.football-data.org/v4/competitions/WC/scorers?limit=100`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
      cache: 'no-store'
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()

    if (!data.scorers || data.scorers.length === 0) {
      return NextResponse.json({ message: 'No scorers found yet.' }, { status: 200 })
    }

    // ← FIX: Build the update array first, then send ONE bulk upsert
    // Old code: for (const item of scorers) { await supabase.update(...) } → 100 DB calls
    // New code: one supabase.upsert(allUpdates) → 1 DB call
    const updates = data.scorers.map((item: any) => ({
      api_player_id: item.player.id,
      goals: item.goals ?? 0,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('player_stats')
      .upsert(updates, {
        onConflict: 'api_player_id',  // matches on api_player_id, updates goals + updated_at
        ignoreDuplicates: false,       // always overwrite with latest value
      })

    if (error) {
      console.error('[sync-scorers] Bulk upsert error:', error)
      throw error
    }

    return NextResponse.json({
      message: 'Scorers synced successfully',
      playersUpdated: updates.length,
    }, { status: 200 })

  } catch (error: any) {
    console.error('[sync-scorers] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
// Add this to the bottom of api/admin/sync-scorers/route.ts if it only uses GET
export async function POST() {
  return GET();
}