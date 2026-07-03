import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==========================================
// 1. THE DEEP NORMALIZER (TITANIUM EDITION)
// ==========================================
function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .replace(/&nbsp;/g, ' ')           // Convert HTML spaces
    // --- NEW: MANUALLY SWAP STUBBORN CHARACTERS ---
    .replace(/[Øø]/g, 'o')             // Fix Nordic O
    .replace(/[ı]/g, 'i')              // Fix Turkish dotless i
    .replace(/[đĐ]/g, 'd')             // Fix Balkan D
    .replace(/[æÆ]/g, 'ae')            // Fix Ash
    .replace(/[ß]/g, 'ss')             // Fix German Eszett
    // ----------------------------------------------
    .normalize("NFD")                  // Deconstruct normal accents (é -> e)
    .replace(/[\u0300-\u036f]/g, "")   // Strip out the isolated accent marks
    .replace(/[^a-zA-Z\s-]/g, "")      // Remove all punctuation EXCEPT letters, spaces, and hyphens
    .replace(/\s+/g, ' ')              // Collapse double spaces
    .toLowerCase()
    .trim();
}

export async function GET() {
  try {
    // ==========================================
    // 2. FETCH WIKIPEDIA RAW DATA
    // ==========================================
    const wikiUrl = 'https://en.wikipedia.org/w/index.php?title=Module:Goalscorers/data/2026_FIFA_World_Cup&action=raw'
    const wikiResponse = await fetch(wikiUrl, { cache: 'no-store' })
    if (!wikiResponse.ok) throw new Error('Failed to reach Wikipedia data module')
    
    const rawLuaText = await wikiResponse.text()

    // Slice the text to ignore "owngoalscorers" so we don't count own goals!
    const goalscorersSection = rawLuaText.split('data.owngoalscorers')[0]
    
    // ==========================================
    // 3. PARSE WIKIPEDIA INTO A CLEAN DICTIONARY
    // ==========================================
    const lines = goalscorersSection.split('\n')
    const wikiScorers: Array<{ name: string, goals: number }> = []

    // This Regex looks for: [[Player Name]] ... followed by the number before the closing bracket
    const lineRegex = /\[\[(.*?)\]\].*?,\s*(\d+)\s*\}/;

    for (const line of lines) {
      const match = line.match(lineRegex)
      if (match) {
        const rawNameBlock = match[1] // e.g., "Kevin Pina (footballer)|Kevin Pina"
        const goals = parseInt(match[2], 10) // e.g., 1

        // If Wikipedia uses a pipe for a display name, grab the right side of the pipe
        const displayName = rawNameBlock.includes('|') 
          ? rawNameBlock.split('|')[1] 
          : rawNameBlock;

        wikiScorers.push({
          name: normalizeName(displayName),
          goals: goals
        })
      }
    }

    // ==========================================
    // 4. FETCH YOUR PRE-EXISTING 108 PLAYERS
    // ==========================================
    const { data: dbPlayers, error: dbError } = await supabase
      .from('player_stats')
      .select('player_id, player_name, goals')

    if (dbError) throw dbError
    if (!dbPlayers || dbPlayers.length === 0) {
      return NextResponse.json({ message: 'No players found in database.' })
    }

    // ==========================================
    // 5. THE ANCHOR LOOP (MATCH & UPDATE)
    // ==========================================
    let updatedCount = 0;
    const updatePromises = [];

    for (const dbPlayer of dbPlayers) {
      const dbNameNormalized = normalizeName(dbPlayer.player_name)

      // Find the player in our parsed Wikipedia list
      const matchedWikiPlayer = wikiScorers.find(wikiP => {
        // We use exact match first. If a name is formatted weirdly, we fallback to an 'includes' check
        // e.g., "Son Heung-min" vs "Heung-Min Son"
        return wikiP.name === dbNameNormalized || 
               wikiP.name.includes(dbNameNormalized) || 
               dbNameNormalized.includes(wikiP.name)
      })

      // If they are on Wikipedia AND their goals have increased, queue an update!
      if (matchedWikiPlayer && matchedWikiPlayer.goals !== dbPlayer.goals) {
        updatePromises.push(
          supabase
            .from('player_stats')
            .update({ 
              goals: matchedWikiPlayer.goals, 
              updated_at: new Date().toISOString() 
            })
            .eq('player_id', dbPlayer.player_id)
        )
        updatedCount++
      }
    }

    // Execute all updates simultaneously to Vercel/Supabase
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises)
    }

    return NextResponse.json({ 
      message: `Sync complete! Parsed ${wikiScorers.length} players from Wiki. Updated ${updatedCount} of your 108 DB players.` 
    })

  } catch (error: any) {
    console.error('[sync-scorers] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// QStash uses POST requests to trigger webhooks safely
export async function POST() {
  return GET();
}