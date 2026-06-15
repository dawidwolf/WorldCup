import { NextResponse } from 'next/server'

export async function GET() {
  const today = new Date().toISOString().split('T')[0]
  
  // Using the exact URL you found!
  const res = await fetch(`https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`, {
    headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! }
  })
  
  const data = await res.json()
  
  const matchesList = data.matches?.map((m: any) => 
    `ID: ${m.id} | ${m.homeTeam.name} vs ${m.awayTeam.name} | Status: ${m.status}`
  ) || []

  return NextResponse.json({ today: matchesList })
}