import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Fetching up to 100 top scorers for the World Cup (WC).
    // You can add &season=2022 to the URL if you need to test with the previous World Cup!
    const res = await fetch(`https://api.football-data.org/v4/competitions/WC/scorers?limit=100`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
    })
    
    if (!res.ok) {
      const errorData = await res.text()
      throw new Error(`API returned status ${res.status}: ${errorData}`)
    }
    
    const data = await res.json()
    
    // Clean the massive JSON into a simple, readable list for our SQL matcher
    const scorersList = data.scorers?.map((item: any) => {
      const playerId = item.player.id
      const playerName = item.player.name
      const teamName = item.team.name
      
      return `ID: ${playerId} | ${playerName} (${teamName})`
    }) || []

    return NextResponse.json({ 
      totalScorersFound: scorersList.length,
      players: scorersList 
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}