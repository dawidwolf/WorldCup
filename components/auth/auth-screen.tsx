"use client"

import { useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

async function setCurrentUserSession(userId: number) {
  const { error } = await supabase.rpc("set_current_user_id", { uid: userId })
  if (error) throw error
}

interface AuthScreenProps {
  onSuccess: (user: { user_id: number; username: string }) => void
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [pin, setPin] = useState("")

  const handleUsernameChange = (value: string) => {
    setUsername(value.toUpperCase())
  }

  const handleRegister = async () => {
    const cleanUsername = username.trim().toUpperCase()
    const cleanPin = pin.trim()
    if (cleanUsername.length < 3) {
      toast.error("Username must be at least 3 characters")
      return
    }
    if (cleanPin.length !== 4) {
      toast.error("PIN must be 4 digits")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("custom_signup", {
        p_username: cleanUsername,
        p_pin: cleanPin,
      })

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error("No user returned from signup")
      }

      await setCurrentUserSession(data[0].user_id)
      toast.success("Account created!")
      onSuccess({ user_id: data[0].user_id, username: String(data[0].username || "").toUpperCase() })
    } catch (err) {
      const e = err as PostgrestError & { message?: string }

      const isUniqueViolation =
        e?.code === "23505" || (e?.message ?? "").includes("users_username_key")

      if (isUniqueViolation) {
        toast.error("Username already taken!", {
          description: "Please choose a different username.",
        })
        return
      }

      toast.error("Signup failed", {
        description: "Please try again.",
      })

      console.error("custom_signup error:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const cleanUsername = username.trim().toUpperCase()
    const cleanPin = pin.trim()
    if (!cleanUsername || cleanPin.length !== 4) {
      toast.error("Please enter username and 4-digit PIN")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select("user_id, username, pin")
        .eq("pin", cleanPin)
        .ilike("username", cleanUsername)
        .limit(2)

      if (error) {
        toast.error("Login failed")
        return
      }

      if (!data || data.length === 0) {
        toast.error("Invalid username or PIN")
        return
      }

      if (data.length > 1) {
        toast.error("Multiple accounts match this username. Please contact support.")
        return
      }
      const matched = data[0]

      await setCurrentUserSession(matched.user_id)
      toast.success("Welcome back!")
      onSuccess({ user_id: matched.user_id, username: matched.username })
    } catch (error: any) {
      console.error("Login error:", error)
      toast.error("Login failed", {
        description: error?.message || "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-primary">World Cup Predictor</h1>
          <p className="text-muted-foreground">Predict the matches of the 2026 FIFA World Cup</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-secondary/30 p-1.5 rounded-2xl">
            <TabsTrigger value="login" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">Log in</TabsTrigger>
            <TabsTrigger value="register" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">Sign up</TabsTrigger>
          </TabsList>
          
          <div className="min-h-[260px]">
            <TabsContent value="login" className="mt-4 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-3.5 pt-1 pb-5 px-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">Username</label>
                    <Input 
                      placeholder="M JACKSON" 
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      disabled={loading}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col items-center">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1 self-start">Passcode (4 digits)</label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={4}
                      placeholder="1234" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      disabled={loading}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base tracking-[0.5em] placeholder:tracking-normal placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2" 
                    onClick={handleLogin} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    Log in
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="mt-4 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="space-y-3.5 pt-1 pb-5 px-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">Username</label>
                    <Input 
                      placeholder="M JACKSON" 
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      disabled={loading}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col items-center">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1 self-start">Passcode (4 digits)</label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={4}
                      placeholder="1234" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      disabled={loading}
                      className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base tracking-[0.5em] placeholder:tracking-normal placeholder:text-muted-foreground/30"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2" 
                    onClick={handleRegister} 
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                    Create Account
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
