"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { MatchCard } from "./match-card"
import { MatchFilters } from "./match-filters"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { getFlag as mapFlag } from '@/lib/flags'
import { getAppTime } from '@/lib/time'
import { useTournamentData } from "@/context/tournament-data-context"
import { PredictionGuideCard } from "./prediction-guide-card"

// Local lightweight types to avoid circular type resolution issues
type Match = {
  match_id: number
  kickoff_utc: string | null
  group?: string | null
  round?: string | null
  is_finished?: boolean | null
  status?: string | null
  home_team_id?: number | null
  away_team_id?: number | null
  home_team?: string | null
  away_team?: string | null
  home_flag?: string | null
  away_flag?: string | null
  home_score?: number | null
  away_score?: number | null
}

type Prediction = {
  match_id: number
  predicted_home_score: number | null
  predicted_away_score: number | null
}

type Team = {
  team_id?: number
  abbreviation?: string | null
  team_flag?: string | null
  fifa_code?: string | null
  team_name?: string | null
  group?: string | null
}

type Standing = {
  team_id?: number
  points?: number
  goal_difference?: number
}

// FIFA 2026 World Cup group seeding order (position within each group, 1-indexed)
const GROUP_SEEDING: Record<string, number> = {
  // Group A
  MEX: 1, RSA: 2, KOR: 3, CZE: 4,

  // Group B
  CAN: 1, BIH: 2, QAT: 3, SUI: 4,

  // Group C
  BRA: 1, MAR: 2, HAI: 3, SCO: 4,

  // Group D
  USA: 1, PAR: 2, AUS: 3, TUR: 4,

  // Group E
  GER: 1, CUW: 2, CIV: 3, ECU: 4,

  // Group F
  NED: 1, JPN: 2, SWE: 3, TUN: 4,

  // Group G
  BEL: 1, EGY: 2, IRN: 3, NZL: 4,

  // Group H
  ESP: 1, CPV: 2, KSA: 3, URU: 4,

  // Group I
  FRA: 1, SEN: 2, IRQ: 3, NOR: 4,

  // Group J
  ARG: 1, ALG: 2, AUT: 3, JOR: 4,

  // Group K
  POR: 1, COD: 2, UZB: 3, COL: 4,

  // Group L
  ENG: 1, CRO: 2, GHA: 3, PAN: 4,
};

const DAY_MS = 24 * 60 * 60 * 1000
const MATCH_LENGTH_MS = 105 * 60 * 1000
const LOCAL_DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const getMatchTimestamp = (kickoffUtc?: string | null) => kickoffUtc ? Date.parse(kickoffUtc) : 0
const getLocalDayKey = (timestampMs: number) => LOCAL_DAY_FORMATTER.format(timestampMs)

const formatMatchTime = (kickoffUtc: string | null, t: (key: string) => string, language: string) => {
  if (!kickoffUtc) return ""
  const now = getAppTime()
  const kickoffMs = getMatchTimestamp(kickoffUtc)
  const todayKey = getLocalDayKey(now.getTime())
  const tomorrowKey = getLocalDayKey(now.getTime() + DAY_MS)
  const kickoffKey = getLocalDayKey(kickoffMs)

  // ⚡ Dynamically switch between Hungarian and English system formats
  const locale = language === 'hu' ? 'hu-HU' : 'en-US'

  const timePart = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(kickoffMs)

  if (kickoffKey === todayKey) return `${t("Today")}, ${timePart}`
  if (kickoffKey === tomorrowKey) return `${t("Tomorrow")}, ${timePart}`

  return new Intl.DateTimeFormat(locale, {
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

export function MatchesTab({ currentUserId, activeFilter, onFilterChange, activePoolId = null }: MatchesTabProps) {
  const { t, language, matches, predictions: predictionsMap, teams, standings, updatePrediction, isLoading: loading } = useTournamentData()
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [now, setNow] = useState(getAppTime())
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const lastSavedRef = useRef<Record<string, { home: number | null; away: number | null }>>({})
  const listRef = useRef<HTMLDivElement | null>(null)

  const translateGroup = (raw: string | null | undefined): string => {
    if (!raw) return ''
    const match = raw.match(/^Group\s+([A-Z]+)$/i)
    if (!match) return raw
    const letter = match[1].toUpperCase()
    const word = t("Group")
    return word === "Group" ? `${word} ${letter}` : `${letter} ${word}`
  }

  const predictions = useMemo(() => {
    const preds: Record<string, { home: number | null; away: number | null }> = {}
    ;(Object.values(predictionsMap) as Prediction[]).forEach((p: Prediction) => {
      preds[String(p.match_id)] = { home: p.predicted_home_score, away: p.predicted_away_score }
    })
    return preds
  }, [predictionsMap])

  useEffect(() => {
    const timer = setInterval(() => setNow(getAppTime()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (activeFilter !== "group") {
      setActiveGroup(null)
    }
  }, [activeFilter])

  const scrollToDefault = () => {
    if (matches.length === 0) return
    const nowDate = getAppTime()
    const todayKey = getLocalDayKey(nowDate.getTime())
    const tomorrowKey = getLocalDayKey(nowDate.getTime() + DAY_MS)
    const todayIndex = matches.findIndex((m: Match) => getLocalDayKey(getMatchTimestamp(m.kickoff_utc || '')) === todayKey)
    let targetIndex = todayIndex
    if (targetIndex === -1) {
      targetIndex = matches.findIndex((m: Match) => getMatchTimestamp(m.kickoff_utc || '') >= nowDate.getTime())
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
    if (filter === 'group' && activeGroup) {
      setActiveGroup(null)
    }
    if (filter === 'all') {
      onFilterChange(filter)
      setTimeout(scrollToDefault, 0)
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    onFilterChange(filter)
  }

  const handlePredictionChange = async (matchIdStr: string, home: number | null, away: number | null) => {
    const matchId = parseInt(matchIdStr, 10)
    setSaving(prev => ({ ...prev, [matchIdStr]: true }))
    
    try {
      if (!currentUserId) {
        throw new Error('No active user')
      }

      if ((home !== null && !Number.isInteger(home)) || (away !== null && !Number.isInteger(away)) || (home !== null && home < 0) || (away !== null && away < 0)) {
        toast.error('Invalid score value')
        return
      }

      await updatePrediction(matchId, home, away)
      
      lastSavedRef.current = {
        ...lastSavedRef.current,
        [matchIdStr]: { home, away }
      }
    } catch (err: any) {
      console.error('Save prediction error:', err)
      toast.error(err?.message || 'Failed to save prediction')
    } finally {
      setSaving(prev => ({ ...prev, [matchIdStr]: false }))
    }
  }

  const calculateStatus = (match: any, prediction: { home: number | null; away: number | null } | undefined) => {
    const rawStatus = String(match.status ?? '').trim().toUpperCase()
    const kickoffMs = getMatchTimestamp(match.kickoff_utc)
    const nowMs = now.getTime()
    const hasPrediction = prediction && prediction.home !== null && prediction.away !== null

    if (rawStatus === 'PST') return 'Postponed'
    if (match.is_finished || rawStatus === 'FT') return 'Finished'
    if (['LIVE', '1H', '2H', 'ET', 'PEN'].includes(rawStatus)) return 'Live'
    if (hasPrediction) return 'Saved'

    const timeDiff = kickoffMs - nowMs
    if (timeDiff <= DAY_MS) return 'Closes soon'

    // ⚡ FIX: Use calendar-day boundaries matching getUpcomingText to prevent mixups
    const localNowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const matchDate = new Date(kickoffMs)
    const localMatchMidnight = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())
    
    const calendarDiffMs = localMatchMidnight.getTime() - localNowMidnight.getTime()
    const daysAway = Math.round(calendarDiffMs / DAY_MS)

    if (daysAway <= 3) return 'Upcoming Yellow'

    return 'Upcoming Grey'
  }

  const getPointsEarned = (match: any, prediction: { home: number | null; away: number | null } | undefined) => {
    const matchEndMs = getMatchTimestamp(match.kickoff_utc) + MATCH_LENGTH_MS
    if (!match.is_finished && now.getTime() < matchEndMs) return undefined
    if (match.home_score === null || match.away_score === null) return undefined
    if (!prediction || prediction.home === null || prediction.away === null) return { amount: 0, type: "pts" }

    const { home_score: actH, away_score: actA } = match
    const { home: pHome, away: pAway } = prediction
    
    if (actH === pHome && actA === pAway) return { amount: 5, type: "Exact Score" }

    const actualDiff = actH - actA
    const predDiff = pHome - pAway
    if (actualDiff === predDiff) return { amount: 3, type: "Goal Difference" }
    if (Math.sign(actualDiff) === Math.sign(predDiff)) return { amount: 2, type: "Outcome" }

    return { amount: 0, type: "pts" }
  }
  const MIN_MS = 60 * 1000
  const HOUR_MS = 60 * MIN_MS
  const DAY_MS = 24 * HOUR_MS

  const getUpcomingText = (kickoffUtc: string | null) => {
    if (!kickoffUtc) return undefined

    const nowAPP = getAppTime()
    const matchTimestamp = getMatchTimestamp(kickoffUtc)
    const diffMs = matchTimestamp - nowAPP.getTime()
    if (isNaN(diffMs) || diffMs <= 0) return undefined

    // 1. If it's less than 24 hours away, keep showing the absolute hour/minute breakdown
    if (diffMs <= DAY_MS) {
      const hours = Math.floor(diffMs / HOUR_MS)
      const mins = Math.floor((diffMs % HOUR_MS) / MIN_MS)
      if (hours > 0) {
        return language === 'hu' ? `${hours} óra múlva` : `Starts in ${hours}h`
      }
      return language === 'hu' ? `${mins} perc múlva` : `Starts in ${mins}m`
    }

    // 2. Calendar-day based math for "X days away"
    const localNowMidnight = new Date(nowAPP.getFullYear(), nowAPP.getMonth(), nowAPP.getDate())
    const matchDate = new Date(matchTimestamp)
    const localMatchMidnight = new Date(matchDate.getFullYear(), matchDate.getMonth(), matchDate.getDate())

    // Calculate difference based on pure calendar boundaries
    const calendarDiffMs = localMatchMidnight.getTime() - localNowMidnight.getTime()
    const days = Math.round(calendarDiffMs / DAY_MS)

    return language === 'hu' ? `${days} nap múlva` : `Starts in ${days} days`
  }

  const filteredMatches = matches.filter((m: Match) => {
    if (activeGroup) return (
      m.group === activeGroup ||
      m.group === `Group ${activeGroup}` ||
      m.round === activeGroup ||
      m.round === `Group ${activeGroup}`
    )
    
    const matchTimestamp = getMatchTimestamp(m.kickoff_utc)
    const nowTimestamp = now.getTime()
    const todayKey = getLocalDayKey(nowTimestamp)
    const tomorrowKey = getLocalDayKey(nowTimestamp + DAY_MS)
    let isToday = getLocalDayKey(matchTimestamp) === todayKey
    
    if (activeFilter === "all") return true
    if (activeFilter === "today") return isToday || getLocalDayKey(matchTimestamp) === tomorrowKey
    return true
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="w-8 h-8 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">{t("Loading Matches...")}</p>
      </div>
    )
  }

  if (activeFilter === "group" && !activeGroup) {
    const groupLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]
    
    return (
      <div className="space-y-3 pt-28">
        <MatchFilters activeFilter={activeFilter} onFilterChange={handleFilterChange} />
        <p className="text-center text-xs font-medium text-muted-foreground px-4 animate-fade-in">
        {t("Click on a group to view the matches.")}
        </p>

        <div className="px-4 pb-24 grid grid-cols-2 gap-4">
          {groupLetters.map(letter => {
            const groupKey = letter
            const grpName = translateGroup(`Group ${letter}`)
            let groupTeams = teams.filter((t: Team) => {
              return t.group === groupKey || t.group === grpName || t.group === `Group ${groupKey}`
            })
            if (groupTeams.length === 0) {
              groupTeams = [1,2,3,4].map(i => ({ abbreviation: `T${i}`, team_flag: null, team_name: `Team ${i}`, team_id: i, group: null }))
            }

            const teamStats = groupTeams.map((t: Team) => {
              const st = standings.find((s: Standing) => s.team_id === t.team_id)
              const raw = t.abbreviation || t.fifa_code || (t.team_name ? t.team_name.split(' ').map((w:any) => w[0]).join('').slice(0,3) : '')
              const abbr = String(raw).toUpperCase()
              const flag = ((t.team_flag ?? undefined) || mapFlag(abbr ?? undefined) || mapFlag(t.fifa_code ?? undefined)) ?? '🏳️'
              return {
                abbr,
                flag,
                pts: st?.points || 0,
                gd: st?.goal_difference || 0
              }
            }).sort((a: any, b: any) => {
                if (a.pts !== 0 || b.pts !== 0) {
                  return b.pts - a.pts || b.gd - a.gd
                }
                const seedA = GROUP_SEEDING[a.abbr] ?? 99
                const seedB = GROUP_SEEDING[b.abbr] ?? 99
                return seedA - seedB
              })

            return (
              <div 
                key={grpName} 
                onClick={() => { setActiveGroup(groupKey); window.scrollTo({ top: 0, behavior: 'auto' }); }}
                className="bg-card border border-border/50 rounded-xl p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex justify-between items-center mb-2 border-b border-border/50 pb-1">
                  <span className="font-bold text-foreground text-sm">{grpName}</span>
                  <div className="flex gap-2 text-[10px] text-muted-foreground w-12 justify-end">
                    <span className="w-5 text-center">{t("GD")}</span>
                    <span className="w-5 text-center">{t("PTS")}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {teamStats.map((ts: any, idx: number) => (
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
        {activeFilter === "all" && !activeGroup && (
          <PredictionGuideCard t={t} />
        )}
        {activeGroup && (
          <button 
            onClick={() => setActiveGroup(null)}
            className="mb-2 text-sm text-primary flex items-center gap-1 hover:underline"
          >
            ← {t("Groups")}
          </button>
        )}
        {activeFilter === 'today' ? (() => {
          const todayKey = getLocalDayKey(now.getTime())
          const tomorrowKey = getLocalDayKey(now.getTime() + DAY_MS)
          const todayMatches = filteredMatches.filter((m: Match) => getLocalDayKey(getMatchTimestamp(m.kickoff_utc)) === todayKey)
          const tomorrowMatches = filteredMatches.filter((m: Match) => getLocalDayKey(getMatchTimestamp(m.kickoff_utc)) === tomorrowKey)

          const renderMatch = (m: any) => {
            const prediction = predictions[m.match_id]
            const cardStatus = calculateStatus(m, prediction)
            const closesIn = getUpcomingText(m.kickoff_utc)
            const isSaved = cardStatus === "Saved"
            const status = m.status

            const matchTime = formatMatchTime(m.kickoff_utc, t, language)
            const homeTeamObj = teams.find((t: Team) => t.team_id === m.home_team_id || t.abbreviation === m.home_team)
            const awayTeamObj = teams.find((t: Team) => t.team_id === m.away_team_id || t.abbreviation === m.away_team)

            const deriveAbbr = (teamObj: any, fallbackName?: string) => {
              const raw = teamObj?.abbreviation || teamObj?.fifa_code || teamObj?.team_name || fallbackName
              if (!raw) return ''
              if (raw.includes(' ')) {
                return raw.split(' ').map((w: string) => w[0]).join('').slice(0,3).toUpperCase()
              }
              return String(raw).slice(0,3).toUpperCase()
            }

            const homeCode = deriveAbbr(homeTeamObj, m.home_team ?? undefined) || (m.home_team_id?.toString() ?? 'H')
            const awayCode = deriveAbbr(awayTeamObj, m.away_team ?? undefined) || (m.away_team_id?.toString() ?? 'A')

            const homeFlag = ((m.home_flag ?? undefined) || homeTeamObj?.team_flag) ?? mapFlag(homeCode ?? undefined)
            const awayFlag = ((m.away_flag ?? undefined) || awayTeamObj?.team_flag) ?? mapFlag(awayCode ?? undefined)

            return (
              <MatchCard
                key={m.match_id}
                id={m.match_id.toString()}
                homeTeam={{ code: homeCode, name: homeTeamObj?.team_name || m.home_team || 'TBD', flag: homeFlag }}
                awayTeam={{ code: awayCode, name: awayTeamObj?.team_name || m.away_team || 'TBD', flag: awayFlag }}
                group={translateGroup(m.group) || m.round || ''}
                matchTime={matchTime}
                status={status ?? undefined}
                isCompleted={m.is_finished === true || m.status === "FT" || cardStatus === "Finished"}
                isLive={["LIVE", "1H", "2H", "ET", "PEN"].includes((m.status ?? "").toUpperCase()) || cardStatus === "Live"}
                isPredictionSaved={isSaved}
                isToday={cardStatus === "Closes soon"}
                isUpcomingFar={cardStatus === "Upcoming Grey"} //
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
                  <div className="text-xs text-muted-foreground font-semibold">{t("Today")}</div>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}
              {todayMatches.map(renderMatch)}
              {tomorrowMatches.length > 0 && (
                <div className="mt-2 mb-2 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/40" />
                  <div className="text-xs text-muted-foreground font-semibold">{t("Tomorrow")}</div>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}
              {tomorrowMatches.map(renderMatch)}
            </>
          )
        })() : (
          (() => {
            return filteredMatches.map((m) => {
              const prediction = predictions[m.match_id]

              const homeTeamObj = teams.find(t => t.team_id === m.home_team_id)
              const awayTeamObj = teams.find(t => t.team_id === m.away_team_id)

              const homeCode = homeTeamObj?.abbreviation || m.home_team || '???'
              const awayCode = awayTeamObj?.abbreviation || m.away_team || '???'
              const homeFlag = homeTeamObj?.team_flag || mapFlag(homeCode)
              const awayFlag = awayTeamObj?.team_flag || mapFlag(awayCode)

              const matchTime = formatMatchTime(m.kickoff_utc, t, language)

              // ⚡ 1. Calculate cardStatus so it is defined and ready to use below
              const cardStatus = calculateStatus(m, prediction)
              const isSaved = cardStatus === "Saved"
              const closesIn = getUpcomingText(m.kickoff_utc)
              const status = m.status

              return (
                <div key={m.match_id} className="relative">
                  <MatchCard
                    id={m.match_id.toString()}
                    homeTeam={{ code: homeCode, name: homeTeamObj?.team_name || m.home_team || 'TBD', flag: homeFlag }}
                    awayTeam={{ code: awayCode, name: awayTeamObj?.team_name || m.away_team || 'TBD', flag: awayFlag }}
                    group={translateGroup(m.group) || m.round || ''}
                    matchTime={matchTime}
                    status={status ?? undefined}
                    isCompleted={m.is_finished === true || m.status === "FT" || cardStatus === "Finished"}
                    isLive={["LIVE", "1H", "2H", "ET", "PEN"].includes((m.status ?? "").toUpperCase()) || cardStatus === "Live"}
                    isPredictionSaved={isSaved}
                    
                    // ⚡ 2. Pass down variables checking against cardStatus values
                    isToday={cardStatus === "Closes soon"}
                    isUpcomingFar={cardStatus === "Upcoming Grey"}
                    
                    closesIn={closesIn}
                    finalScore={m.home_score !== null && m.away_score !== null ? { home: m.home_score as number, away: m.away_score as number } : undefined}
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
            <p className="text-muted-foreground">{t("No matches today.")}</p>
          </div>
        )}
      </div>
    </div>
  )
}