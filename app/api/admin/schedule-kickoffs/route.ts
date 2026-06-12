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

    const { data: matches, error } = await supabase
      .from('matches')
      .select('match_id, kickoff_utc')
      .eq('is_finished', false)
      .eq('is_scheduled_live', false) 
      .not('kickoff_utc', 'is', null)

    if (error) throw error
    if (!matches || matches.length === 0) {
      return NextResponse.json({ message: 'No new matches need scheduling.' })
    }

    const domain = `https://worldcuppred.vercel.app`
    const liveWebhookUrl = `${domain}/api/webhooks/set-live`
    const scoreWebhookUrl = `${domain}/api/webhooks/check-score` // <-- NEW WEBHOOK

    let scheduledCount = 0
    const successfulMatchIds: number[] = []
    const sixDaysFromNow = Date.now() + (6 * 24 * 60 * 60 * 1000)

    for (const match of matches) {
      const kickoffTime = new Date(match.kickoff_utc).getTime()
      if (kickoffTime < Date.now() || kickoffTime > sixDaysFromNow) continue

      const kickoffTimestamp = Math.floor(kickoffTime / 1000)
      const checkScoreTimestamp = kickoffTimestamp + (115 * 60) // <-- Kickoff + 115 Minutes

      // 1. Envelope One: Set Match to LIVE
      const liveResponse = await fetch(`https://qstash.upstash.io/v2/publish/${liveWebhookUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Not-Before': kickoffTimestamp.toString(),
        },
        body: JSON.stringify({ matchId: match.match_id })
      })

      // 2. Envelope Two: Check the Score later
      const scoreResponse = await fetch(`https://qstash.upstash.io/v2/publish/${scoreWebhookUrl}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Not-Before': checkScoreTimestamp.toString(),
        },
        // We pass "retryCount: 0" so it knows this is the first attempt!
        body: JSON.stringify({ matchId: match.match_id, retryCount: 0 }) 
      })

      if (liveResponse.ok && scoreResponse.ok) {
        scheduledCount++
        successfulMatchIds.push(match.match_id)
      }
    }

    if (successfulMatchIds.length > 0) {
      await supabase.from('matches').update({ is_scheduled_live: true }).in('match_id', successfulMatchIds)
    }

    return NextResponse.json({ message: "Success", scheduled: scheduledCount })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}