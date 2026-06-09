"use client"

import { useRef, useState } from "react"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { useTournamentData } from "@/context/tournament-data-context"

async function setCurrentUserSession(userId: number) {
  const { error } = await supabase.rpc("set_current_user_id", { uid: userId })
  if (error) throw error
}

interface AuthScreenProps {
  onSuccess: (user: { user_id: number; username: string }) => void
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  // ⚡ UPDATED: Extracted language and setLanguage
  const { t, language, setLanguage } = useTournamentData()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [pin, setPin] = useState("")
  const pinInputRef = useRef<HTMLInputElement | null>(null)

  const handleUsernameChange = (value: string) => {
    setUsername(value.toUpperCase())
  }

  const handlePinChange = (value: string, onComplete: () => void) => {
    const nextPin = value.replace(/\D/g, "").slice(0, 4)
    setPin(nextPin)

    if (nextPin.length === 4) {
      pinInputRef.current?.blur()
      onComplete()
    }
  }

  const handleRegister = async () => {
    const cleanUsername = username.trim().toUpperCase()
    const cleanPin = pin.trim()
    if (cleanUsername.length < 3) {
      toast.error(t("Username must be at least 3 characters"))
      return
    }
    if (cleanPin.length !== 4) {
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
      onSuccess({ user_id: data[0].user_id, username: String(data[0].username || "").toUpperCase() })
    } catch (err) {
      const e = err as PostgrestError & { message?: string }

      const isUniqueViolation =
        e?.code === "23505" || (e?.message ?? "").includes("users_username_key")

      if (isUniqueViolation) {
        toast.error(t("Username already taken!"), {
          description: t("Please choose a different username."),
        })
        return
      }

      toast.error(t("Signup failed"), {
        description: t("Please try again."),
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
        toast.error(t("Login failed"))
        return
      }

      if (!data || data.length === 0) {
        toast.error(t("Invalid username or PIN"))
        return
      }

      if (data.length > 1) {
        toast.error(t("Multiple accounts match this username. Please contact support."))
        return
      }
      const matched = data[0]

      await setCurrentUserSession(matched.user_id)
      onSuccess({ user_id: matched.user_id, username: matched.username })
    } catch (error: any) {
      console.error(t("Login error:"), error)
      toast.error(t("Login failed"), {
        description: error?.message || t("Please try again."),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await handleLogin()
  }

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await handleRegister()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter text-primary">{t("World Cup Predictor")}</h1>
          <p className="text-muted-foreground">{t("Predict the matches of the 2026 FIFA World Cup")}</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-secondary/30 p-1.5 rounded-2xl">
            <TabsTrigger value="login" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">{t("Log in")}</TabsTrigger>
            <TabsTrigger value="register" className="h-full rounded-xl font-bold uppercase tracking-wide text-xs">{t("Sign up")}</TabsTrigger>
          </TabsList>
          
          <div className="min-h-[260px]">
            <TabsContent value="login" className="mt-4 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="pt-1 pb-5 px-6">
                  <form className="space-y-3.5" onSubmit={handleLoginSubmit}>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t("Username")}</label>
                      <Input 
                        placeholder="M JACKSON" 
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        disabled={loading}
                        className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col items-center">
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1 self-start">{t("PIN")}</label>
                      <Input 
                        ref={pinInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-lpignore="true"
                        data-autofill="false"
                        maxLength={4}
                        placeholder="1234" 
                        value={pin}
                        onChange={(e) => handlePinChange(e.target.value, handleLogin)}
                        disabled={loading}
                        className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base tracking-[0.5em] placeholder:tracking-normal placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <Button 
                      type="submit"
                      className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2" 
                      disabled={loading}
                    >
                      {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                      {t("Log in")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="mt-4 focus-visible:outline-none">
              <Card className="border-border/40 shadow-xl shadow-black/20 bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
                <CardContent className="pt-1 pb-5 px-6">
                  <form className="space-y-3.5" onSubmit={handleRegisterSubmit}>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t("Username")}</label>
                      <Input 
                        placeholder="M JACKSON" 
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        disabled={loading}
                        className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col items-center">
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1 self-start">{t("PIN")}</label>
                      <Input 
                        ref={pinInputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-lpignore="true"
                        data-autofill="false"
                        maxLength={4}
                        placeholder="1234" 
                        value={pin}
                        onChange={(e) => handlePinChange(e.target.value, handleRegister)}
                        disabled={loading}
                        className="bg-secondary/50 border-primary/20 h-12 rounded-xl text-center text-base tracking-[0.5em] placeholder:tracking-normal placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <Button 
                      type="submit"
                      className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2" 
                      disabled={loading}
                    >
                      {loading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                      {t("Create Account")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        {/* ⚡ ADDED: Minimal Language Toggle */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border/50 shadow-lg shadow-black/10">
            <button
              onClick={() => setLanguage('en')}
              className={`w-[60px] py-2 text-center rounded-lg font-bold tracking-wider text-[12px] transition-all ${
                language === 'en'
                  ? 'bg-muted text-foreground shadow-sm border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground bg-transparent border border-transparent'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('hu')}
              className={`w-[60px] py-2 text-center rounded-lg font-bold tracking-wider text-[12px] transition-all ${
                language === 'hu'
                  ? 'bg-muted text-foreground shadow-sm border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground bg-transparent border border-transparent'
              }`}
            >
              HU
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}