// api/webhooks/check-score/route.ts
// Changes from original:
//   1. Sets goals_processed=true when match finishes
//   2. Retry limit increased from 120 → 160 (covers penalty shootouts)
//   3. Upstash-Deduplication-Id header added (no duplicate chains)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://worldcuppred.vercel.app'
const MAX_RETRIES = 160 // ← was 120. Covers 110min + 80min = 190min from kickoff (penalty buffer)

export async function POST(request: Request) {
  try {
    const bodyText = await request.text()
    if (!bodyText) return NextResponse.json({ message: 'Empty body' }, { status: 200 })
    
    const body = JSON.parse(bodyText)
    const { matchId, retryCount = 0 } = body

    if (!matchId) return NextResponse.json({ message: 'Missing matchId' }, { status: 200 })

    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    if (dbError || !match || match.is_finished) {
      return NextResponse.json({ message: 'Match finished or not found' }, { status: 200 })
    }

    const cleanId = parseInt(String(match.api_fixture_id), 10)
    if (isNaN(cleanId)) {
      // ← Added better logging so you can spot KO matches with missing IDs
      console.error(`[check-score] Match ${matchId} has no valid api_fixture_id. Update it in the DB before this round starts.`)
      return NextResponse.json({ message: 'Invalid API ID — update api_fixture_id for this match' }, { status: 200 })
    }

    let isFinished = false
    let homeScore = null
    let awayScore = null

    try {
      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${cleanId}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
      })
      
      if (apiResponse.ok) {
        const textData = await apiResponse.text()
        if (textData) {
          const matchData = JSON.parse(textData)
          homeScore = matchData.score?.fullTime?.home
          awayScore = matchData.score?.fullTime?.away
          isFinished = matchData.status === 'FINISHED'
        }
      }
    } catch (e) {
      console.error(`[check-score] API fetch failed for match ${matchId}, skipping this cycle.`)
    }

    if (isFinished && homeScore != null && awayScore != null) {
      const { error: updateError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT',
        is_finished: true,
        goals_processed: true,   // ← FIX 1: was never set before
      }).eq('match_id', matchId).select()

      if (updateError) {
        console.error('[check-score] Supabase update error:', updateError)
        return NextResponse.json({ message: 'DB Update failed, stopping retry.' }, { status: 200 })
      }

      // Fire sync-scorers silently in background (separate Vercel invocation)
      fetch(`${BASE_URL}/api/admin/sync-scorers`, { method: 'GET' })
        .catch((err) => console.error('[check-score] Silent scorer ping failed:', err))

      return NextResponse.json({ message: `Match ${matchId} finished and updated. ${homeScore}:${awayScore}` }, { status: 200 })
    
    } else {
      if (retryCount < MAX_RETRIES) {
        await fetch(`https://qstash.upstash.io/v2/publish/${BASE_URL}/api/webhooks/check-score`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
            'Content-Type': 'application/json',
            'Upstash-Delay': '30s',
            // ← FIX 2: deduplication key prevents a second chain for the same match
            // from the cron creating duplicate work
            'Upstash-Deduplication-Id': `match-${matchId}-retry-${retryCount + 1}`,
          },
          body: JSON.stringify({ matchId, retryCount: retryCount + 1 })
        })
        return NextResponse.json({ message: `Snoozing... retry #${retryCount + 1}/${MAX_RETRIES}` }, { status: 200 })
      }
      console.error(`[check-score] Max retries hit for match ${matchId}. Check manually.`)
      return NextResponse.json({ message: 'Max retries hit.' }, { status: 200 })
    }

  } catch (error: any) {
    console.error('[check-score] Fatal crash:', error)
    return NextResponse.json({ message: 'Crashed safely' }, { status: 200 })
  }
}