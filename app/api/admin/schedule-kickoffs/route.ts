import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    if (!process.env.QSTASH_TOKEN) {
      return NextResponse.json({ error: 'Missing QSTASH_TOKEN' }, { status: 400 })
    }

    // 1. Find matches that are NOT finished and NOT scheduled yet!
    const { data: matches, error } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc')
      .eq('is_finished', false)
      .eq('is_scheduled_live', false) 
      .not('kickoff_utc', 'is', null)

    if (error) throw error

    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No new matches need scheduling in the upcoming window.' })
    }

    const targetUrl = `https://worldcuppred.vercel.app/api/webhooks/set-live`
    let scheduledCount = 0
    const apiErrors: string[] = []
    const successfulMatchIds: number[] = []

    // Calculate the "6 days from now" limit
    const sixDaysFromNow = Date.now() + (6 * 24 * 60 * 60 * 1000)

    for (const match of matches) {
      const kickoffTime = new Date(match.kickoff_utc).getTime()

      // Skip past matches
      if (kickoffTime < Date.now()) continue
      
      // Skip matches that are more than 6 days in the future (Upstash 7-day limit)
      if (kickoffTime > sixDaysFromNow) continue

      const kickoffTimestamp = Math.floor(kickoffTime / 1000)

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
        successfulMatchIds.push(match.match_id) // Remember this match!
      } else {
        const errorText = await qstashResponse.text()
        apiErrors.push(`Match ${match.match_id} failed: ${errorText}`)
      }
    }

    // 2. Update the database to permanently mark these as scheduled
    if (successfulMatchIds.length > 0) {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ is_scheduled_live: true })
        .in('match_id', successfulMatchIds)
        
      if (updateError) console.error("Error updating DB:", updateError)
    }

    return NextResponse.json({ 
      message: "Rolling schedule complete.",
      successfullyScheduledThisRun: scheduledCount,
      failedToSchedule: apiErrors.length,
      detailedErrors: apiErrors.length > 0 ? apiErrors : 'None!'
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}