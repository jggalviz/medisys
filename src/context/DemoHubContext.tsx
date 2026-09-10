"use client"

/**
 * DemoHubContext · Estado global del Demo Hub.
 * Los botones solo llaman `openDemoHub()`/`closeDemoHub()`; el modal se
 * renderiza una única vez desde el root layout.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react"

import { DemoHubModal } from "@/components/demo/DemoHubModal"

type DemoHubContextValue = {
  isOpen: boolean
  openDemoHub: () => void
  closeDemoHub: () => void
}

const DemoHubContext = createContext<DemoHubContextValue | null>(null)

export function useDemoHub(): DemoHubContextValue {
  const ctx = useContext(DemoHubContext)
  if (!ctx) {
    throw new Error("useDemoHub debe usarse dentro de <DemoHubProvider>.")
  }
  return ctx
}

export function DemoHubProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openDemoHub = useCallback(() => setIsOpen(true), [])
  const closeDemoHub = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, openDemoHub, closeDemoHub }),
    [isOpen, openDemoHub, closeDemoHub]
  )

  return (
    <DemoHubContext.Provider value={value}>
      {children}
      {/* Modal único, montado vía portal al final del body. */}
      <DemoHubModal />
    </DemoHubContext.Provider>
  )
}
