"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { MatchCard } from "./match-card"
import { MatchFilters } from "./match-filters"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { getFlag as mapFlag } from '@/lib/flags'
import { getAppTime } from '@/lib/time'

const DAY_MS = 24 * 60 * 60 * 1000
const MATCH_LENGTH_MS = 105 * 60 * 1000
const LOCAL_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const getMatchTimestamp = (kickoffUtc: string) => Date.parse(kickoffUtc)
const getLocalDayKey = (timestampMs: number) => LOCAL_DAY_FORMATTER.format(timestampMs)

const formatMatchTime = (kickoffUtc: string) => {
  const now = getAppTime()
  const kickoffMs = getMatchTimestamp(kickoffUtc)
  const todayKey = getLocalDayKey(now.getTime())
  const tomorrowKey = getLocalDayKey(now.getTime() + DAY_MS)
  const kickoffKey = getLocalDayKey(kickoffMs)

  const timePart = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(kickoffMs)

  if (kickoffKey === todayKey) return `Today, ${timePart}`
  if (kickoffKey === tomorrowKey) return `Tomorrow, ${timePart}`

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(kickoffMs)
}

interface MatchesTabProps {
  currentUserId: number
  activeFilter: string
  onFilterChange: (filter: string) => void
  activePoolId?: number | null
}

const getFlag = (code: string) => {
  const flags: Record<string, string> = {
    BRA: "đź‡§đź‡·", GER: "đź‡©đź‡Ş", ARG: "đź‡¦đź‡·", FRA: "đź‡«đź‡·", ESP: "đź‡Şđź‡¸", ENG: "đźŹ´ó §ó ˘ó Ąó ®ó §ó ż", 
    POR: "đź‡µđź‡ą", NED: "đź‡łđź‡±", ITA: "đź‡®đź‡ą", BEL: "đź‡§đź‡Ş", CRO: "đź‡­đź‡·", MAR: "đź‡˛đź‡¦", 
    JPN: "đź‡Żđź‡µ", KOR: "đź‡°đź‡·", USA: "đź‡şđź‡¸", MEX: "đź‡˛đź‡˝", CAN: "đź‡¨đź‡¦"
  }
  return flags[code] || "đźŹłď¸Ź"
}

export function MatchesTab({ currentUserId, activeFilter, onFilterChange, activePoolId = null }: MatchesTabProps) {
  const [matches, setMatches] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Record<string, { home: number | null; away: number | null }>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(getAppTime())
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const lastSavedRef = useRef<Record<string, { home: number | null; away: number | null }>>({})
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(getAppTime()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (currentUserId) {
      fetchData()
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    const matchesChannel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any

          const justFinished =
            payload.eventType === 'UPDATE' &&
            newRow?.is_finished === true &&
            oldRow?.is_finished !== true

          if (justFinished) {
            void fetchData()
            return
          }

          setMatches((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((match) => String(match.match_id) !== String(oldRow?.match_id))
            }

            if (!newRow) return prev

            const exists = prev.some((match) => String(match.match_id) === String(newRow.match_id))
            if (!exists) {
              return [...prev, newRow].sort((a, b) => getMatchTimestamp(a.kickoff_utc) - getMatchTimestamp(b.kickoff_utc))
            }

            return prev
              .map((match) => (String(match.match_id) === String(newRow.match_id) ? { ...match, ...newRow } : match))
              .sort((a, b) => getMatchTimestamp(a.kickoff_utc) - getMatchTimestamp(b.kickoff_utc))
          })
        }
      )
      .subscribe()

    const standingsChannel = supabase
      .channel('standings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'standings' },
        (payload) => {
          const newRow = payload.new as any
          const oldRow = payload.old as any

          setStandings((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((standing) => String(standing.standing_id) !== String(oldRow?.standing_id))
            }

            if (!newRow) return prev

            const exists = prev.some((standing) => String(standing.standing_id) === String(newRow.standing_id))
            if (!exists) {
              return [...prev, newRow]
            }

            return prev.map((standing) =>
              String(standing.standing_id) === String(newRow.standing_id)
                ? { ...standing, ...newRow }
                : standing
            )
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(matchesChannel)
      void supabase.removeChannel(standingsChannel)
    }
  }, [currentUserId])

  useEffect(() => {
    if (activeFilter !== "group") {
      setActiveGroup(null)
    }
  }, [activeFilter])

  // Scroll to today's or next upcoming match when 'all' filter is activated (instant)
  const scrollToDefault = () => {
    if (matches.length === 0) return
    const nowDate = getAppTime()
    const todayKey = getLocalDayKey(nowDate.getTime())
    const tomorrowKey = getLocalDayKey(nowDate.getTime() + DAY_MS)
    const todayIndex = matches.findIndex(m => getLocalDayKey(getMatchTimestamp(m.kickoff_utc)) === todayKey)
    let targetIndex = todayIndex
    if (targetIndex === -1) {
      targetIndex = matches.findIndex(m => getMatchTimestamp(m.kickoff_utc) >= nowDate.getTime())
    }
    if (targetIndex === -1) targetIndex = 0

    const child = listRef.current?.children[targetIndex] as HTMLElement | undefined
    const filterEl = document.querySelector('[class*="top-[44px]"]') as HTMLElement | null
    const filterBottom = filterEl ? Math.ceil(filterEl.getBoundingClientRect().bottom) : 0
    if (child) {
      const childDocTop = Math.ceil(child.getBoundingClientRect().top + window.scrollY)
      const desired = childDocTop - filterBottom - 8
      window.scrollTo({ top: Math.max(0, desired), behavior: 'auto' })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }

  const handleFilterChange = (filter: string) => {
    // If user is viewing a group's matches and presses the Groups filter, go back to grid
    if (filter === 'group' && activeGroup) {
      setActiveGroup(null)
    }
    // Scroll behavior: 'all' => instant jump to next match; other filters => instant jump to page top
    if (filter === 'all') {
      onFilterChange(filter)
      // ensure scroll runs after DOM updates
      setTimeout(scrollToDefault, 0)
      return
    }

    // instant jump to top for other filters
    window.scrollTo({ top: 0, behavior: 'auto' })
    onFilterChange(filter)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: mData, error: mError } = await supabase
        .from('matches')
        .select('*')
        .order('kickoff_utc', { ascending: true })

      if (mError) throw mError

      const { data: tData } = await supabase.from('teams').select('*')
      const { data: sData } = await supabase.from('standings').select('*')

      if (tData) setTeams(tData)
      if (sData) setStandings(sData)

      const { data: pData, error: pError } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score')
        .eq('user_id', currentUserId)

      if (pError) throw pError

      const preds: Record<string, { home: number | null; away: number | null }> = {}
      if (pData && Array.isArray(pData)) {
        pData.forEach((r: any) => {
          preds[String(r.match_id)] = { home: r?.predicted_home_score ?? null, away: r?.predicted_away_score ?? null }
        })
      }

      setPredictions(preds)
      if (mData) setMatches(mData)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const handlePredictionChange = async (matchId: string, home: number | null, away: number | null) => {
    setSaving(prev => ({ ...prev, [matchId]: true }))
    const match = matches.find(m => String(m.match_id) === String(matchId))

    try {
      if (!currentUserId) {
        throw new Error('No active user')
      }

      const last = lastSavedRef.current[matchId]
      const payloadHome = home
      const payloadAway = away

      if ((payloadHome !== null && !Number.isInteger(payloadHome)) || (payloadAway !== null && !Number.isInteger(payloadAway)) || (payloadHome !== null && payloadHome < 0) || (payloadAway !== null && payloadAway < 0)) {
        console.warn('Invalid prediction payload prevented', { matchId, payloadHome, payloadAway })
        toast.error('Invalid score value')
        const lastSafe = lastSavedRef.current[matchId]
        setPredictions(prev => ({ ...prev, [matchId]: lastSafe ?? { home: null, away: null } }))
        return
      }

      // optimistic update: only set the provided values (null remains null -> empty input)
      setPredictions(prev => ({ ...prev, [matchId]: { home: payloadHome, away: payloadAway } }))

      const { error } = await supabase.rpc('save_prediction', {
        p_user_id: currentUserId,
        p_match_id: parseInt(matchId, 10),
        p_home_score: payloadHome ?? undefined,
        p_away_score: payloadAway ?? undefined,
      })

      if (error) throw error

      // Mark as saved; allow lastSavedRef to hold nulls if they were explicitly cleared
      lastSavedRef.current = {
        ...lastSavedRef.current,
        [matchId]: { home: payloadHome, away: payloadAway }
      }
    } catch (err: any) {
      console.error('Save prediction error:', err)
      toast.error(err?.message || 'Failed to save prediction')
      const last = lastSavedRef.current[matchId]
      setPredictions(prev => ({ ...prev, [matchId]: last ?? { home: null, away: null } }))
    } finally {
      setSaving(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const calculateStatus = (match: any, prediction: { home: number | null; away: number | null } | undefined) => {
    const rawStatus = String(match.status ?? '').trim().toUpperCase()
    const kickoffMs = getMatchTimestamp(match.kickoff_utc)
    const nowMs = now.getTime()
    const hasPrediction = prediction && prediction.home !== null && prediction.away !== null

    if (rawStatus === 'PST') {
      return 'Postponed'
    }

    if (match.is_finished || rawStatus === 'FT') {
      return 'Finished'
    }

    if (['LIVE', '1H', '2H', 'ET', 'PEN'].includes(rawStatus)) {
      return 'Live'
    }

    if (rawStatus === 'NS' || rawStatus === 'SCHEDULED' || rawStatus === '') {
      if (hasPrediction) return 'Saved'

      const timeDiff = kickoffMs - nowMs
      if (timeDiff > 0 && timeDiff <= DAY_MS) {
        return 'Closes soon'
      }

      return 'Coming up'
    }

    if (hasPrediction) {
      return 'Saved'
    }

    return 'Coming up'
  }

  const getPointsEarned = (match: any, prediction: { home: number | null; away: number | null } | undefined) => {
    const matchEndMs = getMatchTimestamp(match.kickoff_utc) + MATCH_LENGTH_MS
    if (!match.is_finished && now.getTime() < matchEndMs) return undefined
    if (match.home_score === null || match.away_score === null) return undefined
    if (!prediction || prediction.home === null || prediction.away === null) return { amount: 0, type: "pts" }

    const { home_score: actH, away_score: actA } = match
    const { home: pHome, away: pAway } = prediction
    
    if (actH === pHome && actA === pAway) return { amount: 3, type: "Exact Score" }
    
    const actualDiff = actH - actA
    const predDiff = pHome - pAway
    if (Math.sign(actualDiff) === Math.sign(predDiff)) return { amount: 1, type: "Hit" }
    
    return { amount: 0, type: "pts" }
  }

  const filteredMatches = matches.filter(m => {
    if (activeGroup) return m.group === activeGroup || m.round === activeGroup
    
    const matchTimestamp = getMatchTimestamp(m.kickoff_utc)
    const nowTimestamp = now.getTime()
    const todayKey = getLocalDayKey(nowTimestamp)
    const tomorrowKey = getLocalDayKey(nowTimestamp + DAY_MS)
    let isToday = getLocalDayKey(matchTimestamp) === todayKey
    
    if (activeFilter === "all") return true
    if (activeFilter === "today") return isToday || getLocalDayKey(matchTimestamp) === tomorrowKey
    // "group" without activeGroup renders the Grid, so this mapping won't be used
    if (activeFilter === "knockouts") return !m.round?.toLowerCase().includes("group") && !m.group?.toLowerCase().includes("group")
    return true
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="w-8 h-8 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading Matches...</p>
      </div>
    )
  }

  if (activeFilter === "group" && !activeGroup) {
    const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(letter => `Group ${letter}`)
    
    return (
      <div className="space-y-6 pt-28">
        <MatchFilters activeFilter={activeFilter} onFilterChange={handleFilterChange} />
        <div className="px-4 pb-24 grid grid-cols-2 gap-4">
          {groupsList.map(grpName => {
            const groupKey = grpName.replace("Group ", "")
            let groupTeams = teams.filter(t => {
              // Support several possible stored formats: 'A', 'Group A', or full 'Group A'
              return t.group === groupKey || t.group === grpName || t.group === `Group ${groupKey}`
            })
            if (groupTeams.length === 0) {
              groupTeams = [1,2,3,4].map(i => ({ abbreviation: `T${i}`, team_flag: undefined, team_name: `Team ${i}` }))
            }

            const teamStats = groupTeams.map(t => {
              const st = standings.find(s => s.team_id === t.team_id)
              const raw = t.abbreviation || t.fifa_code || (t.team_name ? t.team_name.split(' ').map((w:any) => w[0]).join('').slice(0,3) : '')
              const abbr = String(raw).toUpperCase()
              const flag = t.team_flag || mapFlag(abbr) || mapFlag(t.fifa_code) || '🏳️'
              return {
                abbr,
                flag,
                pts: st?.points || 0,
                gd: st?.goal_difference || 0
              }
            }).sort((a,b) => b.pts - a.pts || b.gd - a.gd)

            return (
              <div 
                  key={grpName} 
                  onClick={() => { setActiveGroup(grpName); window.scrollTo({ top: 0, behavior: 'auto' }); }}
                  className="bg-card border border-border/50 rounded-xl p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                >
                <div className="flex justify-between items-center mb-2 border-b border-border/50 pb-1">
                  <span className="font-bold text-foreground text-sm">{grpName.replace("Group ", "")}</span>
                  <div className="flex gap-2 text-[10px] text-muted-foreground w-12 justify-end">
                    <span className="w-5 text-center">GD</span>
                    <span className="w-5 text-center">PTS</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {teamStats.map((ts, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <div className="w-6 flex justify-center text-muted-foreground font-bold">{idx + 1}</div>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="text-sm">{ts.flag}</span>
                              <span className="text-foreground font-medium truncate">{ts.abbr}</span>
                            </div>
                            <div className="flex gap-2 w-12 justify-end font-mono">
                              <span className="w-5 text-center text-muted-foreground">{ts.gd > 0 ? `+${ts.gd}` : ts.gd}</span>
                              <span className="w-5 text-center font-bold text-foreground">{ts.pts}</span>
                            </div>
                          </div>
                        ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-28">
      <MatchFilters activeFilter={activeFilter} onFilterChange={handleFilterChange} />
      <div ref={listRef} className="space-y-4 px-4 pb-24">
        {activeGroup && (
          <button 
            onClick={() => setActiveGroup(null)}
            className="mb-2 text-sm text-primary flex items-center gap-1 hover:underline"
          >
            ← Groups
          </button>
        )}
        {activeFilter === 'today' ? (() => {
          const todayKey = getLocalDayKey(now.getTime())
          const tomorrowKey = getLocalDayKey(now.getTime() + DAY_MS)
          const todayMatches = filteredMatches.filter(m => getLocalDayKey(getMatchTimestamp(m.kickoff_utc)) === todayKey)
          const tomorrowMatches = filteredMatches.filter(m => getLocalDayKey(getMatchTimestamp(m.kickoff_utc)) === tomorrowKey)

          const renderMatch = (m: any) => {
            const prediction = predictions[m.match_id]
            const status = calculateStatus(m, prediction)

            let closesIn = undefined
            if (status === "Closes soon") {
              const diffMs = getMatchTimestamp(m.kickoff_utc) - now.getTime()
              const hours = Math.floor(diffMs / (1000 * 60 * 60))
              const mins = Math.floor((diffMs / (1000 * 60)) % 60)
              closesIn = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
            }

            const matchTime = formatMatchTime(m.kickoff_utc)
            const homeTeamObj = teams.find(t => t.team_id === m.home_team_id || t.abbreviation === m.home_team)
            const awayTeamObj = teams.find(t => t.team_id === m.away_team_id || t.abbreviation === m.away_team)

            const deriveAbbr = (teamObj: any, fallbackName?: string) => {
              const raw = teamObj?.abbreviation || teamObj?.fifa_code || teamObj?.team_name || fallbackName
              if (!raw) return ''
              if (raw.includes(' ')) {
                return raw.split(' ').map((w: string) => w[0]).join('').slice(0,3).toUpperCase()
              }
              return String(raw).slice(0,3).toUpperCase()
            }

            const homeCode = deriveAbbr(homeTeamObj, m.home_team) || (m.home_team_id?.toString() ?? 'H')
            const awayCode = deriveAbbr(awayTeamObj, m.away_team) || (m.away_team_id?.toString() ?? 'A')

            const homeFlag = m.home_flag || homeTeamObj?.team_flag || mapFlag(homeCode)
            const awayFlag = m.away_flag || awayTeamObj?.team_flag || mapFlag(awayCode)

            const savedPred = lastSavedRef.current[m.match_id]
            const isSaved = !!(savedPred && savedPred.home !== null && savedPred.away !== null)

            return (
              <MatchCard
                key={m.match_id}
                id={m.match_id.toString()}
                homeTeam={{ code: homeCode, name: homeTeamObj?.team_name || m.home_team || 'TBD', flag: homeFlag }}
                awayTeam={{ code: awayCode, name: awayTeamObj?.team_name || m.away_team || 'TBD', flag: awayFlag }}
                group={m.group || m.round || ''}
                matchTime={matchTime}
                status={m.status}
                isCompleted={status === "Finished"}
                isLive={status === "Live"}
                isPredictionSaved={isSaved}
                isToday={status === "Closes soon"}
                closesIn={closesIn}
                finalScore={m.home_score !== null && m.away_score !== null ? { home: m.home_score, away: m.away_score } : undefined}
                pointsEarned={getPointsEarned(m, prediction)}
                controlledPrediction={prediction}
                onPredictionChange={handlePredictionChange}
                isSaving={!!saving[m.match_id]}
                  activePoolId={activePoolId}
                  currentUserId={currentUserId}
              />
            )
          }

          return (
            <>
                  {todayMatches.length > 0 && (
                    <div className="mt-2 mb-2 flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <div className="text-xs text-muted-foreground font-semibold">Today</div>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                  )}
                  {todayMatches.map(renderMatch)}
                  {tomorrowMatches.length > 0 && (
                    <div className="mt-2 mb-2 flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <div className="text-xs text-muted-foreground font-semibold">Tomorrow</div>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                  )}
                  {tomorrowMatches.map(renderMatch)}
            </>
          )
        })() : (
          (() => {
            const todayKey = getLocalDayKey(now.getTime())
            const tomorrowKey = getLocalDayKey(now.getTime() + DAY_MS)

            return filteredMatches.map((m, idx) => {
              const matchDateStr = getLocalDayKey(getMatchTimestamp(m.kickoff_utc))
              const prevDateStr = idx > 0 ? getLocalDayKey(getMatchTimestamp(filteredMatches[idx - 1].kickoff_utc)) : null

              const showTodaySep = matchDateStr === todayKey && prevDateStr !== todayKey
              const showTomorrowSep = matchDateStr === tomorrowKey && prevDateStr !== tomorrowKey
              const showDateSep = prevDateStr !== matchDateStr && !showTodaySep && !showTomorrowSep

              const prediction = predictions[m.match_id]
              const status = calculateStatus(m, prediction)
              
              let closesIn = undefined
              if (status === "Closes soon") {
                const diffMs = getMatchTimestamp(m.kickoff_utc) - now.getTime()
                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                const mins = Math.floor((diffMs / (1000 * 60)) % 60)
                closesIn = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
              }

              const matchTime = formatMatchTime(m.kickoff_utc)
              
              const homeTeamObj = teams.find(t => t.team_id === m.home_team_id || t.abbreviation === m.home_team)
              const awayTeamObj = teams.find(t => t.team_id === m.away_team_id || t.abbreviation === m.away_team)

              const deriveAbbr = (teamObj: any, fallbackName?: string) => {
                const raw = teamObj?.abbreviation || teamObj?.fifa_code || teamObj?.team_name || fallbackName
                if (!raw) return ''
                if (raw.includes(' ')) {
                  return raw.split(' ').map((w: string) => w[0]).join('').slice(0,3).toUpperCase()
                }
                return String(raw).slice(0,3).toUpperCase()
              }

              const homeCode = deriveAbbr(homeTeamObj, m.home_team) || (m.home_team_id?.toString() ?? 'H')
              const awayCode = deriveAbbr(awayTeamObj, m.away_team) || (m.away_team_id?.toString() ?? 'A')

              const homeFlag = m.home_flag || homeTeamObj?.team_flag || mapFlag(homeCode)
              const awayFlag = m.away_flag || awayTeamObj?.team_flag || mapFlag(awayCode)

              const savedPred = lastSavedRef.current[m.match_id]
              const isSaved = !!(savedPred && savedPred.home !== null && savedPred.away !== null)

              return (
                <div key={m.match_id}>
                  {showTodaySep && (
                    <div className="mt-2 mb-2 flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <div className="text-xs text-muted-foreground font-semibold">Today</div>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                  )}
                  {showTomorrowSep && (
                    <div className="mt-2 mb-2 flex items-center gap-3">
                      <div className="flex-1 h-px bg-border/40" />
                      <div className="text-xs text-muted-foreground font-semibold">Tomorrow</div>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                  )}
                  {showDateSep && (
                    <div className="mt-2 mb-2">
                      <div className="h-px bg-border/40" />
                    </div>
                  )}
                  <MatchCard
                    id={m.match_id.toString()}
                    homeTeam={{ code: homeCode, name: homeTeamObj?.team_name || m.home_team || 'TBD', flag: homeFlag }}
                    awayTeam={{ code: awayCode, name: awayTeamObj?.team_name || m.away_team || 'TBD', flag: awayFlag }}
                    group={m.group || m.round || ''}
                    matchTime={matchTime}
                    status={m.status}
                    isCompleted={status === "Finished"}
                    isLive={status === "Live"}
                    isPredictionSaved={isSaved}
                    isToday={status === "Closes soon"}
                    closesIn={closesIn}
                    finalScore={m.home_score !== null && m.away_score !== null ? { home: m.home_score, away: m.away_score } : undefined}
                    pointsEarned={getPointsEarned(m, prediction)}
                    controlledPrediction={prediction}
                    onPredictionChange={handlePredictionChange}
                    isSaving={!!saving[m.match_id]}
                    activePoolId={activePoolId}
                    currentUserId={currentUserId}
                  />
                </div>
              )
            })
          })()
        )}
        {filteredMatches.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No matches today.</p>
          </div>
        )}
      </div>
    </div>
  )
}

