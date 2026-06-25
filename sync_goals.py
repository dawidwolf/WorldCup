import os
import re
import unicodedata
import requests
from supabase import create_client, Client

# 1. Initialize Supabase Client
# It's best practice to load these from environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "your-service-role-key") 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_name(name: str) -> str:
    """
    Transforms names to lowercase and strips all accents/diacritics.
    e.g., 'Kylian Mbappé' -> 'kylian mbappe'
          'Vinícius Júnior' -> 'vinicius junior'
    """
    if not name:
        return ""
    # Convert HTML spaces to normal spaces
    name = name.replace('&nbsp;', ' ')
    # Decompose unicode characters into baseline characters + accents
    nkfd_form = unicodedata.normalize('NFKD', name)
    # Filter out the accent marks
    only_ascii = "".join([c for c in nkfd_form if not unicodedata.combining(c)])
    return only_ascii.lower().strip()

def sync_world_cup_goals():
    print("🔄 Step 1: Fetching your 115 players from Supabase...")
    # Pull only the necessary columns from your table
    response = supabase.table("player_stats_rows").select("player_id, player_name").execute()
    db_players = response.data
    
    if not db_players:
        print("❌ No players found in database.")
        return

    print(f"✅ Loaded {len(db_players)} players from database.")

    print("🌐 Step 2: Fetching live stats from Wikipedia Data Module...")
    wiki_url = "https://en.wikipedia.org/wiki/Module:Goalscorers/data/2026_FIFA_World_Cup?action=raw"
    wiki_response = requests.get(wiki_url)
    if wiki_response.status_code != 200:
        print("❌ Failed to fetch data from Wikipedia.")
        return
        
    # Regex matching the specific format: {"[[Link]]", "COUNTRY", goals }
    matches = re.findall(r'\{\"\[\[(.*?)\]\]\",\s*\"[A-Z]{3}\",\s*(\d+)\s*\}', wiki_response.text)
    
    # Map normalized names to their scraped goal values
    scraped_goals = {}
    for raw_link, goals_str in matches:
        # Strip out everything before the pipe if it's a piped link like [[ActualPage|Display Name]]
        display_name = raw_link.split('|')[-1]
        normalized = normalize_name(display_name)
        scraped_goals[normalized] = int(goals_str)

    print(r"🧠 Step 3: Normalizing names and matching keys...")
    updates_to_send = []
    matched_count = 0

    for p in db_players:
        db_id = p["player_id"]
        db_name = p["player_name"]
        
        normalized_db_name = normalize_name(db_name)
        
        # If the player exists in the Wikipedia scoring list, read their goals.
        # If not, they haven't scored yet, so they default safely to 0.
        current_goals = scraped_goals.get(normalized_db_name, 0)
        
        updates_to_send.append({
            "player_id": db_id,
            "goals": current_goals
        })
        
        if current_goals > 0:
            matched_count += 1

    print(f"📊 Processed matching. Found goals for {matched_count} of your tracking players.")

    print("💾 Step 4: Pushing changes to Supabase...")
    # Use Supabase upsert capability to batch update all rows at once using the primary key
    for i in range(0, len(updates_to_send), 50):  # Chunking into batches of 50 for safety
        chunk = updates_to_send[i:i+50]
        supabase.table("player_stats_rows").upsert(chunk, on_conflict="player_id").execute()

    print("🎉 Sync complete! Database successfully updated.")

if __name__ == "__main__":
    sync_world_cup_goals()