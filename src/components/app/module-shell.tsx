import { type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ModuleShellProps {
  title: string
  description: string
  tableName: string
  children?: ReactNode
}

function getBadgeVariantForTable(tableName: string): 'secondary' | 'core' | 'packaging' | 'batch' {
  const normalized = tableName.toLowerCase()

  if (normalized.includes('raw material')) return 'core'
  if (normalized.includes('raw buying')) return 'packaging'
  if (normalized.includes('inventory')) return 'batch'

  return 'secondary'
}

export function ModuleShell({ title, description, tableName, children }: ModuleShellProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <CardTitle className="text-slate-900 dark:text-slate-100">{title}</CardTitle>
          <Badge className="max-w-full" variant={getBadgeVariantForTable(tableName)}>{tableName}</Badge>
        </div>
        <CardDescription className="text-xs text-slate-600 md:text-sm dark:text-slate-300">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
