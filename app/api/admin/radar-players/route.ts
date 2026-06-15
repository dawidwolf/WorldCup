import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Fetch all teams in the World Cup
    const res = await fetch(`https://api.football-data.org/v4/competitions/WC/teams`, {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
    })
    
    if (!res.ok) throw new Error(`API returned status ${res.status}`)
    const data = await res.json()
    
    const allPlayers: string[] = []

    // Loop through every team and grab their full squad roster
    for (const team of data.teams) {
      if (team.squad && team.squad.length > 0) {
        team.squad.forEach((player: any) => {
          allPlayers.push(`ID: ${player.id} | ${player.name} (${team.name})`)
        })
      }
    }

    return NextResponse.json({ 
      totalPlayersFound: allPlayers.length,
      players: allPlayers 
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}