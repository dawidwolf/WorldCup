import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // 1. Check if the environment variable exists
    if (!process.env.QSTASH_TOKEN) {
      return NextResponse.json({ 
        error: 'CRITICAL ERROR: QSTASH_TOKEN is missing or undefined in Vercel. Make sure you redeployed your Vercel project after adding the variable!' 
      }, { status: 400 })
    }

    // 2. Fetch all un-started matches
    const { data: matches, error } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc')
      .eq('is_finished', false)
      .not('kickoff_utc', 'is', null)

    if (error) throw error

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No matches found in the database that match the scheduling filters.' })
    }

    // 3. YOUR EXACT LIVE DOMAIN
    const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/set-live`

    let scheduledCount = 0
    let skippedPastMatches = 0
    const apiErrors: string[] = []

    // 4. Loop and schedule
    for (const match of matches) {
      const kickoffTime = new Date(match.kickoff_utc)

      // Skip matches that are in the past (QStash rejects past timestamps)
      if (kickoffTime.getTime() < Date.now()) {
        skippedPastMatches++
        continue
      }

      const kickoffTimestamp = Math.floor(kickoffTime.getTime() / 1000)

      const qstashResponse = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Not-Before': kickoffTimestamp.toString(),
        },
        body: JSON.stringify({ matchId: match.match_id })
      })

      if (qstashResponse.ok) {
        scheduledCount++
      } else {
        const errorText = await qstashResponse.text()
        apiErrors.push(`Match ${match.match_id} failed: Status ${qstashResponse.status} - ${errorText}`)
      }
    }

    return NextResponse.json({ 
      message: "Process finished.",
      successfullyScheduled: scheduledCount,
      skippedPastMatches: skippedPastMatches,
      failedToSchedule: apiErrors.length,
      detailedErrors: apiErrors.length > 0 ? apiErrors.slice(0, 5) : 'None!' // Shows the first 5 errors explicitly
    })

  } catch (error: any) {
    console.error('Scheduling Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}