import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // 1. Get all matches from your database that haven't started yet
    const { data: matches, error } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc')
      .eq('is_finished', false)
      .or('status.is.null,status.eq.NS,status.eq.SCHEDULED') // Only un-started matches
      .not('kickoff_utc', 'is', null)

    if (error) throw error

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No matches to schedule.' })
    }

    // 2. The URL of your live Vercel website (Change this to your actual Vercel domain!)
    const VERCEL_DOMAIN = "https://worldcuppred.vercel.app"
    const targetUrl = `${VERCEL_DOMAIN}/api/webhooks/set-live`

    let scheduledCount = 0

    // 3. Loop through all matches and hand an "envelope" to QStash for each one
    for (const match of matches) {
      // Convert kickoff_utc to Unix Timestamp (which QStash requires)
      const kickoffTimestamp = Math.floor(new Date(match.kickoff_utc).getTime() / 1000)

      const qstashResponse = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Not-Before': kickoffTimestamp.toString(), // The exact time to wake up!
        },
        body: JSON.stringify({ matchId: match.match_id }) // The data inside the envelope
      })

      if (qstashResponse.ok) {
        scheduledCount++
      }
    }

    return NextResponse.json({ 
      message: `Successfully scheduled ${scheduledCount} match kickoffs in QStash!` 
    })

  } catch (error: any) {
    console.error('Scheduling Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}