import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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
  addPlan: (data: Omit<Plan, 'id' | 'createdAt' | 'status'>) => void
  updatePlan: (id: string, updates: Partial<Omit<Plan, 'id'>>) => void
  archivePlan: (id: string) => void
  unarchivePlan: (id: string) => void
  deletePlan: (id: string) => void
  getPlan: (id: string) => Plan | undefined
}

const PlansContext = createContext<PlansContextValue | null>(null)

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>(() => {
    try {
      const stored = localStorage.getItem('ck-plans')
      return stored ? (JSON.parse(stored) as Plan[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('ck-plans', JSON.stringify(plans))
  }, [plans])

  const addPlan = (data: Omit<Plan, 'id' | 'createdAt' | 'status'>) => {
    const plan: Plan = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'active',
    }
    setPlans(prev => [plan, ...prev])
  }

  const updatePlan = (id: string, updates: Partial<Omit<Plan, 'id'>>) => {
    setPlans(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)))
  }

  const archivePlan = (id: string) => updatePlan(id, { status: 'archived' })
  const unarchivePlan = (id: string) => updatePlan(id, { status: 'active' })
  const deletePlan = (id: string) => setPlans(prev => prev.filter(p => p.id !== id))
  const getPlan = (id: string) => plans.find(p => p.id === id)

  return (
    <PlansContext.Provider value={{ plans, addPlan, updatePlan, archivePlan, unarchivePlan, deletePlan, getPlan }}>
      {children}
    </PlansContext.Provider>
  )
}

export function usePlans() {
  const ctx = useContext(PlansContext)
  if (!ctx) throw new Error('usePlans must be used within PlansProvider')
  return ctx
}
