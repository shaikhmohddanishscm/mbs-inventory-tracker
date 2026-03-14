import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { supabase } from '@/lib/supabase'
import type { MovementType, Unit } from '@/types/domain'

interface MovementRow {
  id: string
  movement_type: MovementType
  item_name: string
  quantity: number
  unit: Unit
  reference_table: string | null
  occurred_at: string
}

const movementTypes: Array<MovementType | 'ALL'> = ['ALL', 'RAW_BUYING', 'PRODUCTION', 'SALES', 'ADJUSTMENT']

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = () => localDateStr(new Date())
const thirtyDaysAgo = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return localDateStr(d)
}

async function fetchMovements(): Promise<MovementRow[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,movement_type,item_name,quantity,unit,reference_table,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data as MovementRow[]) ?? []
}

export function LogsPage() {
  const [typeFilter, setTypeFilter] = useState<MovementType | 'ALL'>('ALL')
  const [searchText, setSearchText] = useState('')
  const [fromDate, setFromDate] = useState(thirtyDaysAgo())
  const [toDate, setToDate] = useState(today())

  const movementsQuery = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: fetchMovements,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    const fromTime = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null

    return (movementsQuery.data ?? []).filter((row) => {
      if (typeFilter !== 'ALL' && row.movement_type !== typeFilter) return false

      const ts = new Date(row.occurred_at).getTime()
      if (fromTime !== null && ts < fromTime) return false
      if (toTime !== null && ts > toTime) return false

      if (!q) return true
      const haystack = `${row.movement_type} ${row.item_name} ${row.reference_table ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [movementsQuery.data, typeFilter, searchText, fromDate, toDate])

  const { paginatedItems, currentPage, pageSize, setPageSize, totalItems, setCurrentPage } = usePagination(filteredRows, 15)

  return (
    <ModuleShell
      title="Inventory Movement Log"
      description="Append-only movement log for raw buying, production, and sales actions."
      tableName="Inventory Movements"
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
            <div className="space-y-2">
              <Label>Movement Type</Label>
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter((value as MovementType | 'ALL') ?? 'ALL')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {movementTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-search">Search</Label>
              <Input id="log-search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="item, reference..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-from-date">From</Label>
              <Input id="log-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="log-to-date">To</Label>
              <Input id="log-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          {movementsQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading movement log...</p> : null}
          {movementsQuery.isError ? <p className="text-sm text-rose-600">Failed to load movement log.</p> : null}

          {!movementsQuery.isLoading && !movementsQuery.isError ? (
            <>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length ? (
                  paginatedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.movement_type}</TableCell>
                      <TableCell>{row.item_name}</TableCell>
                      <TableCell>{Number(row.quantity).toLocaleString()}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.reference_table ?? '-'}</TableCell>
                      <TableCell>{new Date(row.occurred_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-slate-500 dark:text-slate-400">
                      No movement records match current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalItems > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                <Pagination
                  currentPage={currentPage}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
            </>
          ) : null}
        </section>
      </div>
    </ModuleShell>
  )
}
