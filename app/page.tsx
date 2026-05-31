"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { AuthScreen } from "@/components/auth/auth-screen"
import { PoolsScreen } from "@/components/auth/pools-screen"
import { Header } from "@/components/dashboard/header"
import { BottomNav } from "@/components/dashboard/bottom-nav"
import { BonusTab } from "@/components/dashboard/bonus-tab"
import { RankingsTab } from "@/components/dashboard/rankings-tab"
import { MatchesTab } from "@/components/dashboard/matches-tab"
import { ProfileTab, UserPool } from "@/components/dashboard/profile-tab"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import { getFlag } from "@/lib/flags"

const ACTIVE_POOL_STORAGE_PREFIX = "wc2026_active_pool_id"
type DashboardTab = "matches" | "players" | "rankings" | "profile"

const ROOT_HISTORY_STATE = { kind: "guard" as const }

const getTabFromHash = (hash: string): DashboardTab => {
  const normalized = hash.replace(/^#/, "").toLowerCase()
  if (normalized === "players" || normalized === "rankings" || normalized === "profile") {
    return normalized
  }
  return "matches"
}

const getHistoryUrlForTab = (tab: DashboardTab) => `#${tab}`

const getActivePoolStorageKey = (userId: number) => `${ACTIVE_POOL_STORAGE_PREFIX}_${userId}`

const readStoredActivePoolId = (userId: number) => {
  if (typeof window === "undefined") return null
  const storedValue = localStorage.getItem(getActivePoolStorageKey(userId))
  if (!storedValue) return null
  const parsedValue = Number(storedValue)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

const writeStoredActivePoolId = (userId: number, poolId: number) => {
  if (typeof window === "undefined") return
  localStorage.setItem(getActivePoolStorageKey(userId), String(poolId))
}

const clearStoredActivePoolId = (userId: number) => {
  if (typeof window === "undefined") return
  localStorage.removeItem(getActivePoolStorageKey(userId))
}

export default function Home() {
  const [user, setUser] = useState<{ user_id: number; username: string } | null>(null)
  const [hasPool, setHasPool] = useState<boolean | null>(null)
  const [hasSelectedPool, setHasSelectedPool] = useState(false)
  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null)
  const [invitePoolName, setInvitePoolName] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    setInvitePoolName((params.get("pool") || "").trim().toUpperCase())
  }, [])

  const setCurrentUserSession = async (userId: number) => {
    const { error } = await supabase.rpc("set_current_user_id", { uid: userId })
    if (error) throw error
  }

  const joinInvitePool = async (userId: number, poolName: string) => {
    const normalizedPoolName = poolName.trim().toUpperCase()
    if (!normalizedPoolName) return null

    const { data: pool, error: joinError } = await supabase
      .rpc("join_pool_by_name", {
        p_user_id: userId,
        p_pool_name: normalizedPoolName,
      })
      .single()

    if (joinError) {
      if (joinError.code === "23505") {
        const { data: existingPool, error: fetchError } = await supabase
          .from("pools")
          .select("pool_id, pool_name")
          .ilike("pool_name", normalizedPoolName)
          .limit(1)
          .single()

        if (fetchError) throw fetchError
        return existingPool
      }

      throw joinError
    }

    return pool
  }

  const resolvePoolSelection = async (userId: number) => {
    const { data: pools, error } = await supabase
      .from("user_pools")
      .select(`
        pool_id,
        is_admin,
        joined_at,
        pools (
          pool_name
        )
      `)
      .eq("user_id", userId)

    if (error) throw error

    const formattedPools: UserPool[] = (pools || []).map((up: any) => ({
      pool_id: up.pool_id,
      pool_name: up.pools.pool_name,
      is_admin: up.is_admin,
      joined_at: up.joined_at,
    }))

    setHasPool(formattedPools.length > 0)

    const storedActivePoolId = readStoredActivePoolId(userId)
    const hasStoredPool = storedActivePoolId !== null && formattedPools.some((pool) => pool.pool_id === storedActivePoolId)
    const nextActivePoolId = formattedPools.length === 1
      ? formattedPools[0].pool_id
      : hasStoredPool
        ? storedActivePoolId
        : null

    if (nextActivePoolId !== null) {
      setSelectedPoolId(nextActivePoolId)
      setHasSelectedPool(true)
      writeStoredActivePoolId(userId, nextActivePoolId)
    } else {
      setSelectedPoolId(null)
      setHasSelectedPool(false)
      clearStoredActivePoolId(userId)
    }

    return formattedPools
  }

  useEffect(() => {
    async function checkAuth() {
      const storedUser = localStorage.getItem("wc2026_user")
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser)
          const { data: dbUser, error } = await supabase
            .from("users")
            .select("user_id, username")
            .eq("user_id", parsedUser.user_id)
            .single()

          if (dbUser && !error) {
              setUser({ ...dbUser, username: String(dbUser.username || "").toUpperCase() })
            await setCurrentUserSession(dbUser.user_id)
            if (invitePoolName) {
              try {
                const invitedPool = await joinInvitePool(dbUser.user_id, invitePoolName)
                if (invitedPool) {
                  setHasPool(true)
                  setSelectedPoolId(invitedPool.pool_id)
                  setHasSelectedPool(true)
                  writeStoredActivePoolId(dbUser.user_id, invitedPool.pool_id)
                  setLoading(false)
                  return
                }
              } catch (inviteError: any) {
                toast.error(inviteError.message || "Failed to join invite pool")
              }
            }
              await resolvePoolSelection(dbUser.user_id)
          } else {
            localStorage.removeItem("wc2026_user")
          }
        } catch (e) {
          localStorage.removeItem("wc2026_user")
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [invitePoolName])

  const handleAuthSuccess = async (newUser: { user_id: number; username: string }) => {
    const normalizedUser = { ...newUser, username: newUser.username.toUpperCase() }
    localStorage.setItem("wc2026_user", JSON.stringify(normalizedUser))
    setLoading(true)
    try {
      setUser(normalizedUser)
      await setCurrentUserSession(normalizedUser.user_id)

      if (invitePoolName) {
        const invitedPool = await joinInvitePool(normalizedUser.user_id, invitePoolName)
        if (invitedPool) {
          setHasPool(true)
          setSelectedPoolId(invitedPool.pool_id)
          setHasSelectedPool(true)
          writeStoredActivePoolId(normalizedUser.user_id, invitedPool.pool_id)
          setLoading(false)
          return
        }
      }

      await resolvePoolSelection(normalizedUser.user_id)
    } catch (error: any) {
      toast.error(error.message || "Failed to join invite pool")
    } finally {
      setLoading(false)
    }
  }

  const handlePoolJoined = (poolId: number) => {
    setSelectedPoolId(poolId)
    setHasPool(true)
    setHasSelectedPool(true)
    if (user) {
      writeStoredActivePoolId(user.user_id, poolId)
    }
  }
  const handleLogout = () => {
    if (user) {
      clearStoredActivePoolId(user.user_id)
    }
    localStorage.removeItem("wc2026_user")
    setUser(null)
    setHasPool(null)
    setHasSelectedPool(false)
    setSelectedPoolId(null)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-background"><Spinner className="w-8 h-8 text-primary" /></div>
  if (!user) return <AuthScreen onSuccess={handleAuthSuccess} />
  
  // Show PoolsScreen when no pool is selected. If the user belongs to exactly one
  // pool we auto-select it and show the Dashboard instead.
  if (!hasSelectedPool) return <PoolsScreen userId={user.user_id} onJoined={handlePoolJoined} initialPoolName={invitePoolName} onBack={handleLogout} />

  return <Dashboard user={user} onLogout={handleLogout} onPoolsChanged={setHasPool} onActivePoolChange={(poolId) => {
    setSelectedPoolId(poolId)
    if (poolId === null) {
      if (user) {
        clearStoredActivePoolId(user.user_id)
      }
      setHasSelectedPool(false)
    } else if (user) {
      writeStoredActivePoolId(user.user_id, poolId)
    }
  }} onNavigateToPools={() => {
    if (user) {
      clearStoredActivePoolId(user.user_id)
    }
    setSelectedPoolId(null)
    setHasSelectedPool(false)
  }} activePoolId={selectedPoolId} />
}

function Dashboard({ user, onLogout, onPoolsChanged, onActivePoolChange, onNavigateToPools, activePoolId }: { user: { user_id: number, username: string }, onLogout: () => void, onPoolsChanged: (hasPool: boolean) => void, onActivePoolChange: (poolId: number | null) => void, onNavigateToPools: () => void, activePoolId: number | null }) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<DashboardTab>("matches")
  const [predictions, setPredictions] = useState<Record<string, { home: number | null; away: number | null }>>({})
  const [selectedWinner, setSelectedWinner] = useState<{ code: string; name: string; flag: string } | null>(null)
  const [selectedScorer, setSelectedScorer] = useState<{ name: string; team: string; flag: string } | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [pools, setPools] = useState<UserPool[]>([])
  const [loadingPools, setLoadingPools] = useState(false)
  const lastHasPoolRef = useRef<boolean | null>(null)
  const historyInitializedRef = useRef(false)

  const updateTabHistory = (nextTab: DashboardTab, mode: "push" | "replace" = "push") => {
    if (typeof window === "undefined") return
    const nextState = { kind: "tab" as const, tab: nextTab }
    const nextUrl = getHistoryUrlForTab(nextTab)
    if (mode === "replace") {
      window.history.replaceState(nextState, "", nextUrl)
      return
    }
    window.history.pushState(nextState, "", nextUrl)
  }

  const handleTabChange = (nextTab: DashboardTab) => {
    setActiveTab(nextTab)
    updateTabHistory(nextTab)
  }

  useEffect(() => {
    if (typeof window === "undefined" || historyInitializedRef.current) return

    const initialTab = getTabFromHash(window.location.hash)

    window.history.replaceState(ROOT_HISTORY_STATE, "", getHistoryUrlForTab("matches"))
    window.history.pushState({ kind: "tab", tab: "matches" }, "", getHistoryUrlForTab("matches"))

    if (initialTab !== "matches") {
      window.history.pushState({ kind: "tab", tab: initialTab }, "", getHistoryUrlForTab(initialTab))
    }

    setActiveTab(initialTab)
    historyInitializedRef.current = true
  }, [])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { kind?: string; tab?: DashboardTab } | null

      if (state?.kind === "guard") {
        toast("Press back again to exit game.")
        return
      }

      if (!state) return

      const nextTab = state?.tab ?? getTabFromHash(window.location.hash)
      setActiveTab(nextTab)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    fetchPools()
  }, [user.user_id])

  useEffect(() => {
    if (activeTab === "profile") {
      fetchPicks()
    }
  }, [activeTab, user.user_id])

  const fetchPicks = async () => {
    const { data: userRe } = await supabase.from('users').select('predicted_tournament_winner_id, predicted_top_scorer_id').eq('user_id', user.user_id).single()
    if (userRe) {
      if (userRe.predicted_tournament_winner_id) {
        const { data: t } = await supabase.from('teams').select('*').eq('team_id', userRe.predicted_tournament_winner_id).single()
        if (t) {
          // getFlag is needed here, or we can just import mapFlag from flags, but we can't import in the middle. We'll import getFlag at the top.
          setSelectedWinner({ code: t.abbreviation, name: t.team_name, flag: getFlag(t.abbreviation, t.team_flag) })
        }
      } else { setSelectedWinner(null) }

      if (userRe.predicted_top_scorer_id) {
        const { data: p } = await supabase.from('player_stats').select('*, teams(*)').eq('player_id', userRe.predicted_top_scorer_id).single()
        if (p) {
          setSelectedScorer({ name: p.player_name, team: p.teams?.team_name || "Unknown", flag: getFlag(p.teams?.abbreviation, p.teams?.team_flag) })
        }
      } else { setSelectedScorer(null) }
    }
  }

  const fetchPools = async () => {
    if (!user.user_id || loadingPools) return
    setLoadingPools(true)
    try {
      const { data, error } = await supabase
        .from("user_pools")
        .select(`
          pool_id,
          is_admin,
          joined_at,
          pools (
            pool_name
          )
        `)
        .eq("user_id", user.user_id)

      if (error) throw error

      const formattedPools: UserPool[] = data.map((up: any) => ({
        pool_id: up.pool_id,
        pool_name: up.pools.pool_name,
        is_admin: up.is_admin,
        joined_at: up.joined_at,
      }))

      setPools(formattedPools)
      
      const currentHasPool = formattedPools.length > 0
      if (lastHasPoolRef.current !== currentHasPool) {
        lastHasPoolRef.current = currentHasPool
        onPoolsChanged(currentHasPool)
      }
    } catch (error: any) {
      console.error("Error fetching pools:", error)
      toast.error("Failed to load pools")
    } finally {
      setLoadingPools(false)
    }
  }

  const handleLeavePool = async (poolId: number) => {
    const pool = pools.find(p => p.pool_id === poolId)
    if (pool?.is_admin) {
      // Check if they are the only admin and if there are other members
      const { data: members, error: membersError } = await supabase
        .from("user_pools")
        .select("user_id, is_admin")
        .eq("pool_id", poolId)

      if (membersError) throw membersError

      const otherAdmins = members.filter(m => m.is_admin && m.user_id !== user.user_id)
      if (otherAdmins.length === 0 && members.length > 1) {
        toast.error("You are the only admin. Please promote someone else before leaving.")
        return
      }
    }

    if (!confirm(`Are you sure you want to leave "${pool?.pool_name?.toUpperCase()}"?`)) return

    try {
      const { error } = await supabase
        .rpc("leave_pool", {
          p_user_id: user.user_id,
          p_pool_id: poolId,
        })

      if (error) throw error

      const remainingPools = pools.filter((item) => item.pool_id !== poolId)
      setPools(remainingPools)
      onPoolsChanged(remainingPools.length > 0)

      toast.success(`Left pool "${pool?.pool_name?.toUpperCase()}"`)

      if (activePoolId === poolId) {
        if (remainingPools.length > 0) {
          onActivePoolChange(remainingPools[0].pool_id)
        } else {
          onNavigateToPools()
        }
      }
    } catch (error: any) {
      toast.error("Failed to leave pool")
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "matches":
        return <MatchesTab currentUserId={user.user_id} activeFilter={activeFilter} onFilterChange={setActiveFilter} activePoolId={activePoolId ?? pools.find(p => p.pool_id === activePoolId)?.pool_id ?? pools[0]?.pool_id} />
      case "rankings": return <div className="pt-20 px-4"><RankingsTab poolId={activePoolId ?? pools[0]?.pool_id} poolName={(pools.find(p => p.pool_id === activePoolId)?.pool_name ?? pools[0]?.pool_name)?.toUpperCase()} currentUserId={user.user_id} /></div>
      case "players": return <div className="pt-20 px-4"><BonusTab currentUserId={user.user_id} onSaved={fetchPicks} /></div>
      case "profile": return (
        <div className="pt-20 px-4">
            <ProfileTab 
              username={user.username.toUpperCase()} 
            currentUserId={user.user_id}
            rank={1} 
            userPoints={0} 
            onLogout={onLogout} 
            selectedWinner={selectedWinner} 
            selectedScorer={selectedScorer} 
            onNavigateToRankings={() => handleTabChange("rankings")} 
            onNavigateToBonus={() => handleTabChange("players")} 
            onNavigateToPools={onNavigateToPools}
            pools={pools}
            onLeavePool={handleLeavePool}
          />
        </div>
      )
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 max-w-md mx-auto border-x border-primary/5">
      <Header groupName={(pools.find(p => p.pool_id === activePoolId)?.pool_name || pools[0]?.pool_name || "Global Pool").toUpperCase()} groupCode={(pools.find(p => p.pool_id === activePoolId)?.pool_name?.substring(0, 4).toUpperCase() || pools[0]?.pool_name?.substring(0, 4).toUpperCase() || "MAIN")} rank={1} points={0} onNavigateToRankings={() => handleTabChange("rankings")} />
      {renderTabContent()}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}
