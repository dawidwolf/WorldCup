import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Cron Jobs hit your endpoint using a GET request
export async function GET(request: Request) {
  try {
    // 1. (Optional but recommended) Verify Vercel Cron Secret to prevent random people from triggering this
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const now = new Date().toISOString()

    // 2. Find matches that have started but are NOT finished
    const { data: liveMatches, error: dbError } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc, is_finished')
      .lte('kickoff_utc', now)      // Match kickoff time is in the past/now
      .eq('is_finished', false)     // Match is not marked as finished yet

    if (dbError) throw dbError

    if (!liveMatches || liveMatches.length === 0) {
      return NextResponse.json({ message: 'No live matches right now. Sleeping...' })
    }

    // 3. For every live match, trigger the Upstash Webhook to start the monitoring loop
    const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/check-score`
    
    // We map over them to trigger them concurrently
    const triggerPromises = liveMatches.map(async (match) => {
      const response = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matchId: match.match_id, retryCount: 0 }) // Start retry count at 0
      })
      
      if (!response.ok) {
        console.error(`Failed to trigger match ${match.match_id} in QStash`)
      }
    })

    // Wait for all QStash triggers to fire
    await Promise.all(triggerPromises)

    return NextResponse.json({ 
      message: `Successfully triggered monitoring for ${liveMatches.length} match(es).` 
    })

  } catch (error: any) {
    console.error('Cron Error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}