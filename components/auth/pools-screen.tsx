"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
}

export function PoolsScreen({ userId, onJoined, initialPoolName }: PoolsScreenProps) {
  const [loading, setLoading] = useState(false)
  const [poolName, setPoolName] = useState("")
  const [joinPoolName, setJoinPoolName] = useState("")
  const [userPools, setUserPools] = useState<UserPool[]>([])
  const [loadingExisting, setLoadingExisting] = useState(true)

  useEffect(() => {
    const prefill = (initialPoolName || "").trim()
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
    const normalizedPoolName = poolName.trim()
    if (!normalizedPoolName || normalizedPoolName.length < 3) {
      toast.error("Pool name must be at least 3 characters")
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

      toast.success(`Pool "${pool.pool_name}" created.`)
      onJoined(pool.pool_id)
    } catch (error: any) {
      toast.error(error.message || "Failed to create pool")
    } finally {
      setLoading(false)
    }
  }

  const handleJoinPool = async () => {
    const normalizedPoolName = joinPoolName.trim()
    if (!normalizedPoolName) {
      toast.error("Please enter the pool name")
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
          toast.error("You are already in this pool")
        } else {
          throw joinError
        }
        return
      }

      toast.success(`Joined ${pool.pool_name}!`)
      onJoined(pool.pool_id)
    } catch (error: any) {
      toast.error(error.message || "Failed to join pool")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-primary">Pool Membership</h1>
          <p className="text-muted-foreground font-medium">Every predictor needs a community.</p>
        </div>

        <Tabs defaultValue="join" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-secondary/30 p-1.5 rounded-2xl">
            <TabsTrigger value="join" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">Join Pool</TabsTrigger>
            <TabsTrigger value="create" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">Create Pool</TabsTrigger>
          </TabsList>
          <div className="min-h-[350px]">
            <TabsContent value="join" className="mt-6 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-4 pt-6 pb-6 px-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Pool Name</label>
                    <Input 
                      placeholder="e.g. SoccerLads" 
                      value={joinPoolName}
                      onChange={(e) => setJoinPoolName(e.target.value)}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" 
                    onClick={handleJoinPool} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    Join Pool
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="mt-6 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-4 pt-6 pb-6 px-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">New Pool Name</label>
                    <Input 
                      placeholder="e.g. Office Champs" 
                      value={poolName}
                      onChange={(e) => setPoolName(e.target.value)}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" 
                    onClick={handleCreatePool} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    Create Pool
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="mt-8 space-y-4">
              {userPools.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">Pools</p>
                  <div className="grid gap-3">
                    {userPools.map((pool) => (
                      <Button 
                        key={pool.pool_id} 
                        variant="secondary" 
                        className="h-16 justify-between px-5 bg-card border border-border/40 hover:border-primary/50 transition-all rounded-2xl shadow-lg shadow-black/10 group active:scale-[0.98]"
                        onClick={() => onJoined(pool.pool_id)}
                      >
                        <span className="font-bold text-lg text-foreground">{pool.pool_name}</span>
                        <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          Enter →
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
