import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BASE_URL = 'https://worldcuppred.vercel.app'
const MAX_RETRIES = 160

export async function POST(request: Request) {
  let matchIdToRetry: number | null = null;
  let nextRetryCount = 1;

  try {
    const bodyText = await request.text()
    if (!bodyText) return NextResponse.json({ message: 'Empty body' }, { status: 200 })
    
    const body = JSON.parse(bodyText)
    const { matchId, retryCount = 0 } = body

    if (!matchId) return NextResponse.json({ message: 'Missing matchId' }, { status: 200 })
    
    // Save these variables globally so the catch block can use them to retry
    matchIdToRetry = matchId;
    nextRetryCount = retryCount + 1;

    const { data: match, error: dbError } = await supabase
      .from('matches')
      .select('api_fixture_id, is_finished')
      .eq('match_id', matchId)
      .single()

    // FIX 1: If there's a DB connection error, don't stop! Throw an error so it drops down and retries.
    if (dbError) {
      console.error('[check-score] Transient DB Error:', dbError)
      throw new Error("Temporary DB Error"); 
    }

    // If it's legitimately finished, we can safely exit.
    if (!match || match.is_finished) {
      return NextResponse.json({ message: 'Match finished or not found' }, { status: 200 })
    }

    const cleanId = parseInt(String(match.api_fixture_id), 10)
    if (isNaN(cleanId)) {
      console.error(`[check-score] Match ${matchId} has no valid api_fixture_id. Update it in the DB before this round starts.`)
      return NextResponse.json({ message: 'Invalid API ID' }, { status: 200 })
    }

    let isFinished = false
    let homeScore = null
    let awayScore = null

    try {
      const apiResponse = await fetch(`https://api.football-data.org/v4/matches/${cleanId}`, {
        headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
        cache: 'no-store'
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
      console.error(`[check-score] API fetch failed, skipping this cycle.`)
    }

    if (isFinished && homeScore != null && awayScore != null) {
      const { error: updateError } = await supabase.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'FT',
        is_finished: true,
        goals_processed: true,
      }).eq('match_id', matchId).select()

      // FIX 2: If the DB update fails (e.g. trigger crash), throw error so it retries!
      if (updateError) {
        console.error('[check-score] Supabase update error:', updateError)
        throw new Error("DB Update Failed");
      }

      fetch(`${BASE_URL}/api/admin/sync-scorers`, { method: 'GET' }).catch(() => {})
      return NextResponse.json({ message: `Match ${matchId} finished and updated. ${homeScore}:${awayScore}` }, { status: 200 })
    } 

  } catch (error: any) {
    console.error('[check-score] Caught error, dropping down to retry loop:', error)
  }

  // --- THE BULLETPROOF RETRY BLOCK ---
  // If the code reaches this line, it means we MUST snooze and try again, 
  // regardless of whether it was a DB crash, an API error, or just the match still playing.
  
  if (matchIdToRetry && nextRetryCount <= MAX_RETRIES) {
    const qstashRes = await fetch(`https://qstash.upstash.io/v2/publish/${BASE_URL}/api/webhooks/check-score`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': '30s',
        'Upstash-Deduplication-Id': `match-${matchIdToRetry}-retry-${nextRetryCount}`,
      },
      body: JSON.stringify({ matchId: matchIdToRetry, retryCount: nextRetryCount })
    });

    // FIX 3: Check if Upstash is rejecting our messages due to free tier limits
    if (!qstashRes.ok) {
      console.error('[check-score] QStash rejected the retry. Are you out of messages?', await qstashRes.text());
    }

    return NextResponse.json({ message: `Snoozing... retry #${nextRetryCount}/${MAX_RETRIES}` }, { status: 200 })
  }

  return NextResponse.json({ message: 'Max retries hit or fatal setup error.' }, { status: 200 })
}