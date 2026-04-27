import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as api from '../api/plansApi'

export interface Plan {
  id: string
  name: string
  createdAt: string
  status: 'active' | 'archived'
  fileName: string
  fileSize: number
  fileType: string
}

interface PlansContextValue {
  plans: Plan[]
  loading: boolean
  error: string | null
  addPlan: (name: string, file: File) => Promise<void>
  updatePlan: (id: string, updates: { name?: string; file?: File }) => Promise<void>
  archivePlan: (id: string) => Promise<void>
  unarchivePlan: (id: string) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  getPlan: (id: string) => Plan | undefined
}

const PlansContext = createContext<PlansContextValue | null>(null)

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .fetchPlans()
      .then(setPlans)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load plans'))
      .finally(() => setLoading(false))
  }, [])

  const addPlan = async (name: string, file: File) => {
    const plan = await api.createPlan(name, file)
    setPlans(prev => [plan, ...prev])
  }

  const updatePlan = async (id: string, updates: { name?: string; file?: File }) => {
    const updated = await api.patchPlan(id, updates)
    setPlans(prev => prev.map(p => (p.id === id ? updated : p)))
  }

  const archivePlan = async (id: string) => {
    const updated = await api.patchPlan(id, { status: 'archived' })
    setPlans(prev => prev.map(p => (p.id === id ? updated : p)))
  }

  const unarchivePlan = async (id: string) => {
    const updated = await api.patchPlan(id, { status: 'active' })
    setPlans(prev => prev.map(p => (p.id === id ? updated : p)))
  }

  const deletePlan = async (id: string) => {
    await api.removePlan(id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  const getPlan = (id: string) => plans.find(p => p.id === id)

  return (
    <PlansContext.Provider
      value={{ plans, loading, error, addPlan, updatePlan, archivePlan, unarchivePlan, deletePlan, getPlan }}
    >
      {children}
    </PlansContext.Provider>
  )
}

export function usePlans() {
  const ctx = useContext(PlansContext)
  if (!ctx) throw new Error('usePlans must be used within PlansProvider')
  return ctx
}
