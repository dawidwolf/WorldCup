﻿"use client"

import React, { useState, useEffect, useRef } from "react"
import { MatchesTab, MatchesTabActions } from "@/components/dashboard/matches-tab"
import { RankingsTab } from "@/components/dashboard/rankings-tab"
import { BonusTab } from "@/components/dashboard/bonus-tab"
import { ProfileTab } from "@/components/dashboard/profile-tab"
import { Header } from "@/components/dashboard/header"
import { BottomNav } from "@/components/dashboard/bottom-nav"
import { AuthScreen } from "@/components/auth/auth-screen"
import { PoolsScreen } from "@/components/auth/pools-screen"
import { getFlag } from "@/lib/flags"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TournamentDataProvider, useTournamentData } from "@/context/tournament-data-context"
import { UserPool } from "@/components/dashboard/profile-tab"

type DashboardTab = "matches" | "rankings" | "players" | "profile"

const ROOT_HISTORY_STATE = { kind: "guard" }

function getHistoryUrlForTab(tab: DashboardTab): string {
  return tab === "matches" ? "/" : `/#${tab}`
}

function getTabFromHash(hash: string): DashboardTab {
  const cleanHash = hash.replace("#", "")
  if (["rankings", "players", "profile"].includes(cleanHash)) {
    return cleanHash as DashboardTab
  }
  return "matches"
}

function Dashboard({ user, onLogout, onPoolsChanged, onNavigateToPools }: {
  user: { user_id: number, username: string },
  onLogout: () => void,
  onPoolsChanged: (hasPool: boolean) => void,
  onNavigateToPools: () => void
}) {
  // ⚡ FIX 1: Extracted 'refreshData' so we can manually trigger global state updates
  const { t, userProfile, teams, players, pools, activePoolId, setActivePool, isLoading: isDataLoading, refreshData } = useTournamentData()

  // ✅ ALL HOOKS MUST BE AT THE TOP
  const [activeFilter, setActiveFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<DashboardTab>("matches")
  const historyInitializedRef = useRef(false)
  const matchesTabRef = useRef<MatchesTabActions>(null);

  const selectedWinner = React.useMemo(() => {
    if (!userProfile?.predicted_tournament_winner_id || !teams.length) return null
    const t = teams.find(t => t.team_id === userProfile.predicted_tournament_winner_id)
    if (!t) return null
    return { code: String(t.abbreviation || ''), name: String(t.team_name || ''), flag: getFlag(t.abbreviation ?? t.team_flag ?? undefined) }
  }, [userProfile?.predicted_tournament_winner_id, teams])

  const selectedScorer = React.useMemo(() => {
    if (!userProfile?.predicted_top_scorer_id || !players.length) return null
    const p = players.find(p => p.player_id === userProfile.predicted_top_scorer_id)
    if (!p) return null
    const t = teams.find(t => t.team_id === p.team_id)
    return { name: String(p.player_name || ''), team: t?.team_name || "Unknown", flag: getFlag(t?.abbreviation ?? t?.team_flag ?? undefined) }
  }, [userProfile?.predicted_top_scorer_id, players, teams])

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
    const isAlreadyOnMatches = activeTab === 'matches';
    const wasAlreadyAllFilter = activeFilter === 'all';

    if (activeTab !== nextTab) {
      setActiveTab(nextTab);
      updateTabHistory(nextTab);
    }

    if (nextTab === "matches") {
      setActiveFilter("all");
      localStorage.setItem("wc2026_matches_filter", "all");

      if (isAlreadyOnMatches && wasAlreadyAllFilter) {
        setTimeout(() => matchesTabRef.current?.scrollToDefault(), 0);
      }
    }
  };

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
        toast(t("Press back again to exit game."))
        return
      }
      if (!state) return
      const nextTab = state?.tab ?? getTabFromHash(window.location.hash)
      setActiveTab(nextTab)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [t])

  useEffect(() => {
    onPoolsChanged(pools.length > 0)
  }, [pools.length, onPoolsChanged])

  const handleLeavePool = async (poolId: number) => {
    const pool = pools.find(p => p.pool_id === poolId)
    if (pool?.is_admin) {
      const { data: members, error: membersError } = await supabase
        .from("user_pools")
        .select("user_id, is_admin")
        .eq("pool_id", poolId)
      if (membersError) throw membersError
      const otherAdmins = members.filter(m => m.is_admin && m.user_id !== user.user_id)
      if (otherAdmins.length === 0 && members.length > 1) {
        toast.error(t("You are the only admin. Please promote someone else before leaving."))
        return
      }
    }
    if (!confirm(`Are you sure you want to leave "${pool?.pool_name?.toUpperCase()}"?`)) return
    
    try {
      const { error } = await supabase.rpc("leave_pool", {
        p_user_id: user.user_id,
        p_pool_id: poolId,
      })
      if (error) throw error
      toast.success(`${t("Left pool")} "${pool?.pool_name?.toUpperCase()}"`)
      
      // ⚡ FIX 1: Instantly resync the entire app state to wipe the left pool from memory
      await refreshData()

      if (activePoolId === poolId) {
        const remainingPools = pools.filter(p => p.pool_id !== poolId)
        if (remainingPools.length > 0) {
          setActivePool(remainingPools[0].pool_id)
        } else {
          onNavigateToPools()
        }
      }
    } catch (error: any) {
      toast.error(t("Failed to leave pool"))
    }
  }

  // ✅ NOW it's safe to do conditional returns — all hooks are above
  if (isDataLoading || !activePoolId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Spinner className="w-12 h-12 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">{t("Initializing tournament data...")}</p>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "matches":
        return <MatchesTab ref={matchesTabRef} currentUserId={user.user_id} activeFilter={activeFilter} onFilterChange={setActiveFilter} activePoolId={activePoolId || pools[0]?.pool_id} />
      case "rankings":
        return <div className="pt-20 px-4"><RankingsTab poolId={activePoolId || pools[0]?.pool_id} poolName={(pools.find(p => p.pool_id === activePoolId)?.pool_name || pools[0]?.pool_name || "").toUpperCase()} currentUserId={user.user_id} /></div>
      case "players":
        return <div className="pt-20 px-4"><BonusTab currentUserId={user.user_id} /></div>
      case "profile":
        return (
          <div className="pt-20 px-4">
            <ProfileTab
              hideLanguageToggle={false}
              username={user.username.toUpperCase()}
              currentUserId={user.user_id}
              rank={1}
              userPoints={userProfile?.points_total || 0}
              onLogout={onLogout}
              selectedWinner={selectedWinner}
              selectedScorer={selectedScorer}
              onNavigateToRankings={() => handleTabChange("rankings")}
              onNavigateToBonus={() => handleTabChange("players")}
              onNavigateToPools={onNavigateToPools}
              pools={pools as UserPool[]}
              onLeavePool={handleLeavePool}
            />
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24 max-w-md mx-auto border-x border-primary/5">
      <Header
        groupName={(pools.find(p => p.pool_id === activePoolId)?.pool_name || pools[0]?.pool_name || "Global Pool").toUpperCase()}
        groupCode={(pools.find(p => p.pool_id === activePoolId)?.pool_name?.substring(0, 4).toUpperCase() || pools[0]?.pool_name?.substring(0, 4).toUpperCase() || "MAIN")}
        rank={1}
        points={userProfile?.points_total || 0}
        onNavigateToRankings={() => handleTabChange("rankings")}
      />
      {renderTabContent()}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}


export default function Page() {
  const [view, setView] = useState<"auth" | "pools" | "dashboard">("auth")
  const [user, setUser] = useState<{ user_id: number; username: string } | null>(null)
  const [hasPool, setHasPool] = useState<boolean>(false)
  const [isInitializing, setIsInitializing] = useState(true)
  

  useEffect(() => {
    const checkUser = async () => {
      try {
        const storedUser = localStorage.getItem("worldcup_user_new")
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser)
          const { data, error } = await supabase
            .from("users")
            .select("user_id, username")
            .eq("user_id", parsedUser.user_id)
            .single()

          if (data && !error) {
            // ⚡ CRITICAL FIX: Tell Postgres who the user is on page refresh!
            await supabase.rpc("set_current_user_id", { uid: data.user_id })
            
            setUser(data)
            setView("dashboard")
          } else {
            localStorage.removeItem("worldcup_user_new")
          }
        }
      } catch (e) {
        console.error("Auth check failed:", e)
      } finally {
        setIsInitializing(false)
      }
    }
    checkUser()
  }, [])

  const handleLogin = (userData: { user_id: number; username: string }) => {
    setUser(userData)
    localStorage.setItem("worldcup_user_new", JSON.stringify(userData))
    
    // ⚡ FIX: Clear any lingering URL hashes (like #profile) from previous sessions
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname)
    }
    
    setView("dashboard")
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem("worldcup_user_new")
    
    // ⚡ FIX: Clean the URL so the next login starts completely fresh
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname)
    }
    
    setView("auth")
  }

  const handlePoolsChanged = (newHasPool: boolean) => {
    setHasPool(newHasPool)
  }

  // 1. SYSTEM INITIALIZING SCREEN
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Spinner className="w-12 h-12 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">Restoring session...</p>
      </div>
    )
  }

  // 2. MASTER TRANSLATION RENDERING BLOCK
  return (
    <div className="min-h-screen bg-background transition-colors duration-150">
      {/* Passing user?.user_id || null guarantees context initializes safely even when logged out! */}
      <TournamentDataProvider userId={user ? user.user_id : null}>
        {view === "auth" || !user ? (
          <AuthScreen onSuccess={handleLogin} />
        ) : (
          <AppRouter
            view={view}
            setView={(v) => setView(v)}
            user={user}
            onLogout={handleLogout}
            onPoolsChanged={handlePoolsChanged}
            onNavigateToPools={() => setView("pools")}
          />
        )}
      </TournamentDataProvider>
    </div>
  )
}



function AppRouter({
  view,
  setView,
  user,
  onLogout,
  onPoolsChanged,
  onNavigateToPools
}: {
  view: "auth" | "pools" | "dashboard",
  setView: (v: "auth" | "pools" | "dashboard") => void,
  user: { user_id: number; username: string },
  onLogout: () => void,
  onPoolsChanged: (hasPool: boolean) => void,
  onNavigateToPools: () => void,
}) {
  const { pools, activePoolId, setActivePool, isLoading, userProfile } = useTournamentData()
  const { t } = useTournamentData()

  // ⚡ FIX 2: Prevent premature routing. If the context hasn't loaded the newly 
  // logged-in user's profile yet, treat the session as temporarily "stale".
  const isStaleSession = Boolean(user && userProfile?.user_id !== user.user_id)

  // 1. ALL HOOKS RUN UNCONDITIONALLY AT THE VERY TOP
  React.useEffect(() => {
    // ⚡ Halt all routing actions if data is loading OR if the session is stale
    if (isLoading || isStaleSession) return 
    
    // No pools -> force Pools screen
    if (!pools || pools.length === 0) {
      setView("pools")
      onPoolsChanged(false)
      return
    }

    // Has pools
    onPoolsChanged(true)

    // If exactly one pool, auto-select it and ensure we're on the dashboard
    if (pools.length === 1) {
      const single = pools[0]
      setActivePool(single.pool_id)
      if (view !== "pools") {
        setView("dashboard")
      }
      return
    }

    // Multiple pools: if the current view is 'pools' we keep it, otherwise go to dashboard
    if (pools.length > 1 && view !== "pools") {
      setView("dashboard")
    }
  }, [pools, isLoading, isStaleSession, view, setView, onPoolsChanged, setActivePool])

  // 2. THE FLOATING SAFETY CURTAIN: BLOCKS ALL FLASHES
  if (isLoading || isStaleSession || (view === "dashboard" && !activePoolId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Spinner className="w-12 h-12 text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">{t("Syncing tournament data...")}</p>
      </div>
    )
  }

  // 3. REGULAR ROUTING CONDITIONS
  if (view === "pools") {
    return (
      <PoolsScreen 
        userId={user.user_id} 
        onJoined={(poolId) => {
          setActivePool(poolId)
          setView("dashboard")
        }} 
        onBack={() => setView("auth")}
      />
    )
  }

  return (
    <Dashboard 
      user={user} 
      onLogout={onLogout} 
      onPoolsChanged={onPoolsChanged}
      onNavigateToPools={onNavigateToPools}
    />
  )
}
