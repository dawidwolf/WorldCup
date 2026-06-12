import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // 1. Get 20 players from your database who don't have an API ID yet
    const { data: localPlayers, error: dbError } = await supabase
      .from('player_stats')
      .select('player_id, player_name')
      .is('api_player_id', null)
      .limit(20) // STRICT LIMIT: Protects your 100 daily API calls!

    if (dbError) throw dbError
    
    if (!localPlayers || localPlayers.length === 0) {
      return NextResponse.json({ message: 'All players already have API IDs!' })
    }

    let successCount = 0
    const logs: string[] = []

    // 2. Loop through these 20 players and ask API-Football for their ID
    for (const player of localPlayers) {
      // Format the name for a URL (e.g., "Kylian Mbappé" -> "Kylian%20Mbapp%C3%A9")
      const encodedName = encodeURIComponent(player.player_name)
      
      const apiResponse = await fetch(`https://v3.football.api-sports.io/players?search=${encodedName}`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_API_KEY! }
      })

      if (!apiResponse.ok) {
        logs.push(`API Error for ${player.player_name}`)
        continue
      }
      
      const apiData = await apiResponse.json()
      
      // 3. If the API found a matching player, grab the ID and save it!
      if (apiData.response && apiData.response.length > 0) {
        const apiPlayerId = apiData.response[0].player.id

        const { error: updateError } = await supabase
          .from('player_stats')
          .update({ api_player_id: apiPlayerId })
          .eq('player_id', player.player_id)

        if (!updateError) {
          successCount++
          logs.push(`✅ MATCHED: ${player.player_name} -> ID: ${apiPlayerId}`)
        }
      } else {
        logs.push(`❌ NOT FOUND: Could not find API match for "${player.player_name}"`)
      }
    }

    return NextResponse.json({
      message: `Batch complete. Successfully mapped ${successCount} out of ${localPlayers.length} players.`,
      playersRemainingToMap: "Refresh the page to process the next 20!",
      details: logs
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}