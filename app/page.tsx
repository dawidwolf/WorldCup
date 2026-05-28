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
    setInvitePoolName((params.get("pool") || "").trim())
  }, [])

  const joinInvitePool = async (userId: number, poolName: string) => {
    const normalizedPoolName = poolName.trim()
    if (!normalizedPoolName) return null

    const { data: pools, error: fetchError } = await supabase
      .from("pools")
      .select("pool_id, pool_name")
      .ilike("pool_name", normalizedPoolName)
      .limit(2)

    if (fetchError) throw fetchError
    if (!pools || pools.length === 0) throw new Error("Pool not found")
    if (pools.length > 1) throw new Error("Multiple pools match this invite link. Please use the exact pool name.")

    const pool = pools[0]

    const { data: membership, error: membershipError } = await supabase
      .from("user_pools")
      .select("pool_id")
      .eq("user_id", userId)
      .eq("pool_id", pool.pool_id)
      .limit(1)

    if (membershipError) throw membershipError

    if (!membership || membership.length === 0) {
      const { error: joinError } = await supabase
        .from("user_pools")
        .insert([{ user_id: userId, pool_id: pool.pool_id, is_admin: false }])

      if (joinError && joinError.code !== "23505") throw joinError
    }

    return pool
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
            setUser(dbUser)
            if (invitePoolName) {
              try {
                const invitedPool = await joinInvitePool(dbUser.user_id, invitePoolName)
                if (invitedPool) {
                  setHasPool(true)
                  setSelectedPoolId(invitedPool.pool_id)
                  setHasSelectedPool(true)
                  setLoading(false)
                  return
                }
              } catch (inviteError: any) {
                toast.error(inviteError.message || "Failed to join invite pool")
              }
            }
              const { data: pools, count } = await supabase
                .from("user_pools")
                .select("pool_id", { count: "exact" })
                .eq("user_id", dbUser.user_id)

              setHasPool(pools && pools.length > 0)
              // If the user belongs to exactly one pool, auto-select it and skip PoolsScreen
              if (typeof count === "number" && count === 1) {
                setSelectedPoolId(pools?.[0]?.pool_id ?? null)
                setHasSelectedPool(true)
              }
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
    localStorage.setItem("wc2026_user", JSON.stringify(newUser))
    setUser(newUser)
    setLoading(true)
    try {
      if (invitePoolName) {
        const invitedPool = await joinInvitePool(newUser.user_id, invitePoolName)
        if (invitedPool) {
          setHasPool(true)
          setSelectedPoolId(invitedPool.pool_id)
          setHasSelectedPool(true)
          setLoading(false)
          return
        }
      }

      const { data, count } = await supabase
        .from("user_pools")
        .select("pool_id", { count: "exact" })
        .eq("user_id", newUser.user_id)

      setHasPool(data && data.length > 0)
      if (typeof count === "number" && count === 1) {
        setSelectedPoolId(data?.[0]?.pool_id ?? null)
        setHasSelectedPool(true)
      }
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
  }
  const handleLogout = () => {
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
  if (!hasSelectedPool) return <PoolsScreen userId={user.user_id} onJoined={handlePoolJoined} initialPoolName={invitePoolName} />

  return <Dashboard user={user} onLogout={handleLogout} onPoolsChanged={setHasPool} onNavigateToPools={() => { setSelectedPoolId(null); setHasSelectedPool(false) }} activePoolId={selectedPoolId} />
}

function Dashboard({ user, onLogout, onPoolsChanged, onNavigateToPools, activePoolId }: { user: { user_id: number, username: string }, onLogout: () => void, onPoolsChanged: (hasPool: boolean) => void, onNavigateToPools: () => void, activePoolId: number | null }) {
  const [activeFilter, setActiveFilter] = useState("all")
  const [activeTab, setActiveTab] = useState("matches")
  const [predictions, setPredictions] = useState<Record<string, { home: number | null; away: number | null }>>({})
  const [selectedWinner, setSelectedWinner] = useState<{ code: string; name: string; flag: string } | null>(null)
  const [selectedScorer, setSelectedScorer] = useState<{ name: string; team: string; flag: string } | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [pools, setPools] = useState<UserPool[]>([])
  const [loadingPools, setLoadingPools] = useState(false)
  const lastHasPoolRef = useRef<boolean | null>(null)

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

    if (!confirm(`Are you sure you want to leave "${pool?.pool_name}"?`)) return

    try {
      const { error } = await supabase
        .from("user_pools")
        .delete()
        .eq("user_id", user.user_id)
        .eq("pool_id", poolId)

      if (error) throw error

      toast.success(`Left pool "${pool?.pool_name}"`)
      fetchPools()
      if (activePoolId === poolId || pools.length <= 1) {
        onNavigateToPools()
      }
    } catch (error: any) {
      toast.error("Failed to leave pool")
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "matches":
        return <MatchesTab currentUserId={user.user_id} activeFilter={activeFilter} onFilterChange={setActiveFilter} activePoolId={activePoolId ?? pools.find(p => p.pool_id === activePoolId)?.pool_id ?? pools[0]?.pool_id} />
      case "rankings": return <div className="pt-20 px-4"><RankingsTab poolId={activePoolId ?? pools[0]?.pool_id} poolName={pools.find(p => p.pool_id === activePoolId)?.pool_name ?? pools[0]?.pool_name} currentUserId={user.user_id} /></div>
      case "players": return <div className="pt-20 px-4"><BonusTab currentUserId={user.user_id} onSaved={fetchPicks} /></div>
      case "profile": return (
        <div className="pt-20 px-4">
          <ProfileTab 
            username={user.username} 
            rank={1} 
            userPoints={0} 
            onLogout={onLogout} 
            selectedWinner={selectedWinner} 
            selectedScorer={selectedScorer} 
            onNavigateToRankings={() => setActiveTab("rankings")} 
            onNavigateToBonus={() => setActiveTab("players")} 
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
      <Header groupName={pools.find(p => p.pool_id === activePoolId)?.pool_name || pools[0]?.pool_name || "Global Pool"} groupCode={(pools.find(p => p.pool_id === activePoolId)?.pool_name?.substring(0, 4).toUpperCase() || pools[0]?.pool_name?.substring(0, 4).toUpperCase() || "MAIN")} rank={1} points={0} onNavigateToRankings={() => setActiveTab("rankings")} />
      {renderTabContent()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
