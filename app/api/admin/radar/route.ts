import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // We drop the date filters to grab the ENTIRE competition at once!
    const res = await fetch(`https://api.football-data.org/v4/competitions/WC/matches`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
    })
    
    if (!res.ok) throw new Error(`API returned status ${res.status}`)
    const data = await res.json()
    
    // Sort and clean the massive list so it's easy to read
    const matchesList = data.matches?.map((m: any) => {
      const stage = m.stage === 'GROUP_STAGE' ? m.group : m.stage
      return `ID: ${m.id} | ${m.homeTeam.name} vs ${m.awayTeam.name} (${stage})`
    }) || []

    return NextResponse.json({ 
      totalMatchesFound: matchesList.length,
      matches: matchesList 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}