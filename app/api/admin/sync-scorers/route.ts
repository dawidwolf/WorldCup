import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // 1. Fetch the official top scorers list for the World Cup
    const res = await fetch(`https://api.football-data.org/v4/competitions/WC/scorers?limit=100`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
      // Prevent Next.js from caching this API call so it's always fresh
      cache: 'no-store' 
    })

    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()

    if (!data.scorers || data.scorers.length === 0) {
      return NextResponse.json({ message: 'No scorers found yet.' }, { status: 200 })
    }

    let updatedCount = 0

    // 2. Loop through the API scorers and safely update your database
    for (const item of data.scorers) {
      const apiPlayerId = item.player.id
      const totalGoals = item.goals // The API gives us their exact total goals!

      const { error } = await supabase
        .from('player_stats')
        .update({ goals: totalGoals, updated_at: new Date().toISOString() })
        .eq('api_player_id', apiPlayerId)

      if (!error) updatedCount++
    }

    return NextResponse.json({ 
      message: 'Scorers synced successfully', 
      playersUpdated: updatedCount 
    }, { status: 200 })

  } catch (error: any) {
    console.error("Scorer Sync Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}