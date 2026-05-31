"use client"

import { useCallback, useEffect, useRef } from "react"

type HistoryLayerOptions = {
  layerId: string
  isOpen: boolean
  onClose: () => void
  enabled?: boolean
}

const HISTORY_LAYER_KEY = "__wc2026_history_layer"

export function useHistoryLayer({ layerId, isOpen, onClose, enabled = true }: HistoryLayerOptions) {
  const openRef = useRef(isOpen)
  const pushedRef = useRef(false)
  const closingFromHistoryRef = useRef(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    openRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    if (isOpen && !pushedRef.current) {
      window.history.pushState({ [HISTORY_LAYER_KEY]: layerId }, "", window.location.href)
      pushedRef.current = true
    }

    if (!isOpen) {
      pushedRef.current = false
    }
  }, [enabled, isOpen, layerId])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    const handlePopState = () => {
      if (!openRef.current || !pushedRef.current) return
      closingFromHistoryRef.current = true
      pushedRef.current = false
      onCloseRef.current()
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [enabled])

  const closeWithHistory = useCallback(() => {
    if (!enabled || typeof window === "undefined") {
      onCloseRef.current()
      return
    }

    if (closingFromHistoryRef.current) {
      closingFromHistoryRef.current = false
      onCloseRef.current()
      return
    }

    if (pushedRef.current && window.history.state?.[HISTORY_LAYER_KEY] === layerId) {
      window.history.back()
      return
    }

    onCloseRef.current()
  }, [enabled, layerId])

  return { closeWithHistory }
}