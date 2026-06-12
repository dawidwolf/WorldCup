import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    // 1. Process strictly 5 players per click to stay under the 10/minute limit!
    const { data: localPlayers, error: dbError } = await supabase
      .from('player_stats')
      .select('player_id, player_name')
      .is('api_player_id', null)
      .limit(5) 

    if (dbError) throw dbError
    
    if (!localPlayers || localPlayers.length === 0) {
      return NextResponse.json({ message: 'All players already have API IDs!' })
    }

    let successCount = 0
    const logs: string[] = []

    for (const player of localPlayers) {
      // 2. Try the full name first
      const encodedName = encodeURIComponent(player.player_name)
      let apiResponse = await fetch(`https://v3.football.api-sports.io/players?search=${encodedName}`, {
        headers: { 'x-apisports-key': process.env.API_FOOTBALL_API_KEY! }
      })

      if (!apiResponse.ok) {
        logs.push(`HTTP Blocked for ${player.player_name}`)
        continue
      }
      
      let apiData = await apiResponse.json()

      // Look for hidden API limits/errors inside the JSON
      if (apiData.errors && Object.keys(apiData.errors).length > 0) {
        logs.push(`API REJECTED ${player.player_name}: ${JSON.stringify(apiData.errors)}`)
        continue
      }
      
      // 3. SMART FALLBACK: If not found, try searching just their LAST name!
      if (!apiData.response || apiData.response.length === 0) {
        const nameParts = player.player_name.split(' ')
        const lastName = nameParts[nameParts.length - 1] // Grabs the last word
        
        logs.push(`Full name not found. Retrying with last name: "${lastName}"`)
        
        const encodedLastName = encodeURIComponent(lastName)
        apiResponse = await fetch(`https://v3.football.api-sports.io/players?search=${encodedLastName}`, {
          headers: { 'x-apisports-key': process.env.API_FOOTBALL_API_KEY! }
        })
        apiData = await apiResponse.json()
        
        if (apiData.errors && Object.keys(apiData.errors).length > 0) {
          logs.push(`API REJECTED ${lastName}: ${JSON.stringify(apiData.errors)}`)
          continue
        }
      }
      
      // 4. Save the Match!
      if (apiData.response && apiData.response.length > 0) {
        // Grab the ID of the first player it found
        const apiPlayerId = apiData.response[0].player.id
        const apiPlayerName = apiData.response[0].player.name // See what name the API actually uses

        await supabase
          .from('player_stats')
          .update({ api_player_id: apiPlayerId })
          .eq('player_id', player.player_id)

        successCount++
        logs.push(`✅ MATCHED: ${player.player_name} -> ID: ${apiPlayerId} (API uses: ${apiPlayerName})`)
      } else {
        logs.push(`❌ NOT FOUND: Even after last name search for "${player.player_name}"`)
      }
    }

    return NextResponse.json({
      message: `Batch complete. Successfully mapped ${successCount} out of ${localPlayers.length} players.`,
      details: logs
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}