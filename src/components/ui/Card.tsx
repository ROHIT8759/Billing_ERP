'use client'

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface CardProps {
  className?: string
  children: ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn('bg-white rounded-sm border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: string
  trendUp?: boolean
  color?: 'indigo' | 'emerald' | 'violet' | 'amber'
}

export function StatCard({ title, value, icon, trend, trendUp, color = 'indigo' }: StatCardProps) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {trend && (
            <p className={cn('text-xs mt-2 font-medium', trendUp ? 'text-emerald-600' : 'text-red-600')}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', colors[color])}>
          {icon}
        </div>
      </div>
    </Card>
  )
}
