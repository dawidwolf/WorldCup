import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/teams', {
      headers: { 'X-Auth-Token': process.env.API_FOOTBALL_API_KEY! },
      cache: 'no-store'
    })
    
    const data = await res.json()
    
    // Return absolutely EVERYTHING so we can read the exact message from the API
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ developer_error: error.message })
  }
}