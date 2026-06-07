"use client"

import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTournamentData } from '@/context/tournament-data-context'

interface UserPool {
  pool_id: number
  pool_name: string
  is_admin: boolean
  joined_at: string
}

interface PoolsScreenProps {
  userId: number
  onJoined: (poolId: number) => void
  initialPoolName?: string
  onBack?: () => void
}

export function PoolsScreen({ userId, onJoined, initialPoolName, onBack }: PoolsScreenProps) {
  // ⚡ 1. GLOBAL HOOK INITIALIZATION (Called safely and unconditionally at the top)
  const { refreshData, setActivePool } = useTournamentData()
  const { t } = useTournamentData()
  const [loading, setLoading] = useState(false)
  const [poolName, setPoolName] = useState("")
  const [joinPoolName, setJoinPoolName] = useState("")
  const [userPools, setUserPools] = useState<UserPool[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)

  const handlePoolNameChange = (value: string) => setPoolName(value.toUpperCase())
  const handleJoinPoolNameChange = (value: string) => setJoinPoolName(value.toUpperCase())

  useEffect(() => {
    const prefill = (initialPoolName || "").trim().toUpperCase()
    if (prefill) {
      setJoinPoolName(prefill)
    }
  }, [initialPoolName])

  useEffect(() => {
    async function fetchUserPools() {
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
        .eq("user_id", userId)

      if (!error && data) {
        const formatted: UserPool[] = data.map((up: any) => ({
          pool_id: up.pool_id,
          pool_name: up.pools.pool_name,
          is_admin: up.is_admin,
          joined_at: up.joined_at,
        }))
        setUserPools(formatted)
      }
      setLoadingExisting(false)
    }
    fetchUserPools()
  }, [userId])

  const handleCreatePool = async () => {
    const normalizedPoolName = poolName.trim().toUpperCase()
    if (!normalizedPoolName || normalizedPoolName.length < 3) {
      toast.error(t("Pool name must be at least 3 characters"))
      return
    }

    setLoading(true)
    try {
      const { data: pool, error: poolError } = await supabase
        .rpc("create_pool_and_join", {
          p_user_id: userId,
          p_pool_name: normalizedPoolName,
        })
        .single()

      if (poolError) throw poolError

      toast.success(`${t("Pool created:")} ${pool.pool_name.toUpperCase()}`)
      
      try {
        localStorage.setItem(`wc2026_active_pool_id_${userId}`, String(pool.pool_id))
      } catch (e) {
        // ignore
      }

      // ⚡ 2. Safely call the context actions extracted from the top
      setActivePool(pool.pool_id)
      onJoined(pool.pool_id)
      await refreshData()
    } catch (error: any) {
      toast.error(t(error.message || "Failed to create pool"))
    } finally {
      setLoading(false)
    }
  }

  const handleJoinPool = async () => {
    const normalizedPoolName = joinPoolName.trim().toUpperCase()
    if (!normalizedPoolName) {
      toast.error(t("Please enter the pool name"))
      return
    }

    setLoading(true)
    try {
      const { data: pool, error: joinError } = await supabase
        .rpc("join_pool_by_name", {
          p_user_id: userId,
          p_pool_name: normalizedPoolName,
        })
        .single()

      if (joinError) {
        if (joinError.code === "23505") {
          toast.error(t("You are already in this pool"))
        } else {
          throw joinError
        }
        return
      }

      toast.success(t("Joined pool successfully!"))
      
      try {
        localStorage.setItem(`wc2026_active_pool_id_${userId}`, String(pool.pool_id))
      } catch (e) {
        // ignore
      }

      // ⚡ 3. Safely call the context actions extracted from the top
      setActivePool(pool.pool_id)
      onJoined(pool.pool_id)
      await refreshData()
    } catch (error: any) {
      toast.error(t(error.message || "Failed to join pool"))
    } finally {
      setLoading(false)
    }
  }

  // ... (Leave the remaining return statement code underneath completely untouched)

  return (
    <div className="flex flex-col min-h-screen px-4 py-4">
      <div className="w-full max-w-md mx-auto space-y-2">
        <div className="relative flex items-center pt-1 min-h-10">
          <button
            type="button"
            onClick={onBack}
            className="relative z-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to auth"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("Back")}
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold tracking-tighter text-primary">
            {t("Pools")}
          </h1>
        </div>

        {userPools.length > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3">
              {userPools.map((pool) => (
                <Button
                  key={pool.pool_id}
                  variant="secondary"
                  className="h-16 justify-between px-5 bg-card border border-border/40 hover:border-primary/50 transition-all rounded-2xl shadow-lg shadow-black/10 group active:scale-[0.98]"
                  onClick={() => onJoined(pool.pool_id)}
                >
                  <span className="text-sm font-semibold tracking-wide text-muted-foreground">{pool.pool_name.toUpperCase()}</span>
                  <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {t("Enter →")}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="join" className="w-full mt-12">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-secondary/30 p-1.5 rounded-2xl mb-0">
            <TabsTrigger value="join" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">{t("Join Pool")}</TabsTrigger>
            <TabsTrigger value="create" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">{t("Create Pool")}</TabsTrigger>
          </TabsList>
            <div className="min-h-[300px]">
            <TabsContent value="join" className="mt-2 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-3.5 pt-5 pb-5 px-6">
                  <div className="space-y-1">
                    <label className="mb-3 block text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t("Pool Name")}</label>
                    <Input 
                      placeholder="FOOTBALLBOYS" 
                      value={joinPoolName}
                      onChange={(e) => handleJoinPoolNameChange(e.target.value)}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" 
                    onClick={handleJoinPool} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    {t("Join Pool")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="mt-2 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-3.5 pt-5 pb-5 px-6">
                  <div className="space-y-1">
                    <label className="mb-3 block text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t("Pool Name")}</label>
                    <Input 
                      placeholder="FOOTBALLBOYS" 
                      value={poolName}
                      onChange={(e) => handlePoolNameChange(e.target.value)}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" 
                    onClick={handleCreatePool} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    {t("Create Pool")}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
