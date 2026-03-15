import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ScrollText } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

/* ─── Types ─── */
interface MovementRow {
  id: string
  movement_type: string
  item_name: string
  quantity: number
  unit: string
  occurred_at: string
}

interface NameOption {
  id: string
  name: string
}

interface LogMovementRow {
  id: string
  movement_type: MovementType
  item_name: string
  quantity: number
  unit: Unit
  reference_table: string | null
  occurred_at: string
}

type ChartView = 'RAW_BUYING' | 'PRODUCTION' | 'SALES'

/* ─── Constants ─── */
const chartViews: { value: ChartView; label: string }[] = [
  { value: 'RAW_BUYING', label: 'Raw Material Buying Trends' },
  { value: 'PRODUCTION', label: 'Inventory / Production Trends' },
  { value: 'SALES', label: 'Sales Trends' },
]

const chartColors: Record<ChartView, { border: string; bg: string }> = {
  RAW_BUYING: { border: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  PRODUCTION: { border: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  SALES: { border: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

const movementTypes: Array<MovementType | 'ALL'> = ['ALL', 'RAW_BUYING', 'PRODUCTION', 'SALES', 'ADJUSTMENT']

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const todayStr = () => localDateStr(new Date())
const thirtyDaysAgo = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return localDateStr(d)
}

/* ─── API ─── */
async function fetchMovements(type: string): Promise<MovementRow[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,movement_type,item_name,quantity,unit,occurred_at')
    .eq('movement_type', type)
    .order('occurred_at', { ascending: true })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data as MovementRow[]) ?? []
}

async function fetchRawMaterialNames(): Promise<NameOption[]> {
  const { data, error } = await supabase.from('raw_materials').select('id,name').order('name')
  if (error) throw new Error(error.message)
  return (data as NameOption[]) ?? []
}

async function fetchProductNames(): Promise<NameOption[]> {
  const { data, error } = await supabase.from('products').select('id,name').order('name')
  if (error) throw new Error(error.message)
  return (data as NameOption[]) ?? []
}

async function fetchAllMovements(): Promise<LogMovementRow[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,movement_type,item_name,quantity,unit,reference_table,occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(error.message)
  return (data as LogMovementRow[]) ?? []
}

/* ─── Helpers ─── */
function groupByDate(movements: MovementRow[], filterItem: string) {
  const map = new Map<string, number>()
  for (const m of movements) {
    if (filterItem && filterItem !== 'ALL' && m.item_name !== filterItem) continue
    const dateKey = new Date(m.occurred_at).toLocaleDateString()
    map.set(dateKey, (map.get(dateKey) ?? 0) + Math.abs(Number(m.quantity)))
  }
  const sorted = Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
  return {
    labels: sorted.map(([d]) => d),
    data: sorted.map(([, v]) => v),
  }
}

function makeChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.1)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.1)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        beginAtZero: true,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }
}

function exportToCsv(rows: LogMovementRow[]) {
  const header = 'Type,Item,Qty,Unit,Reference,Date\n'
  const body = rows
    .map((r) =>
      [
        r.movement_type,
        `"${r.item_name}"`,
        Math.abs(Number(r.quantity)),
        r.unit,
        r.reference_table ?? '',
        new Date(r.occurred_at).toLocaleString(),
      ].join(','),
    )
    .join('\n')

  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `movements_${localDateStr(new Date())}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/* ─── Component ─── */
export function DashboardPage() {
  const [chartView, setChartView] = useState<ChartView>('RAW_BUYING')
  const [itemFilter, setItemFilter] = useState('ALL')

  // Movement log state
  const [showMovements, setShowMovements] = useState(false)
  const [logTypeFilter, setLogTypeFilter] = useState<MovementType | 'ALL'>('ALL')
  const [logSearchText, setLogSearchText] = useState('')
  const [logFromDate, setLogFromDate] = useState(thirtyDaysAgo())
  const [logToDate, setLogToDate] = useState(todayStr())

  // Chart queries
  const movementsQuery = useQuery({
    queryKey: ['dashboard-movements', chartView],
    queryFn: () => fetchMovements(chartView),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const rawMaterialNamesQuery = useQuery({
    queryKey: ['dashboard-raw-material-names'],
    queryFn: fetchRawMaterialNames,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: chartView === 'RAW_BUYING',
  })

  const productNamesQuery = useQuery({
    queryKey: ['dashboard-product-names'],
    queryFn: fetchProductNames,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: chartView === 'PRODUCTION' || chartView === 'SALES',
  })

  // Movement log query
  const logQuery = useQuery({
    queryKey: ['inventory-movements-log'],
    queryFn: fetchAllMovements,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: showMovements,
  })

  const filterOptions: NameOption[] =
    chartView === 'RAW_BUYING' ? (rawMaterialNamesQuery.data ?? []) : (productNamesQuery.data ?? [])

  const filterLabel =
    chartView === 'RAW_BUYING' ? 'All Materials' : 'All Products'

  const chartData = useMemo(() => {
    const grouped = groupByDate(movementsQuery.data ?? [], itemFilter)
    const colors = chartColors[chartView]
    const viewLabel = chartViews.find((v) => v.value === chartView)?.label ?? ''
    return {
      labels: grouped.labels,
      datasets: [
        {
          label: viewLabel,
          data: grouped.data,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }
  }, [movementsQuery.data, itemFilter, chartView])

  // Movement log filtering
  const filteredLogRows = useMemo(() => {
    const q = logSearchText.trim().toLowerCase()
    const fromTime = logFromDate ? new Date(`${logFromDate}T00:00:00`).getTime() : null
    const toTime = logToDate ? new Date(`${logToDate}T23:59:59`).getTime() : null

    return (logQuery.data ?? []).filter((row) => {
      if (logTypeFilter !== 'ALL' && row.movement_type !== logTypeFilter) return false

      const ts = new Date(row.occurred_at).getTime()
      if (fromTime !== null && ts < fromTime) return false
      if (toTime !== null && ts > toTime) return false

      if (!q) return true
      const haystack = `${row.movement_type} ${row.item_name} ${row.reference_table ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [logQuery.data, logTypeFilter, logSearchText, logFromDate, logToDate])

  const { paginatedItems: logPaginatedItems, currentPage: logPage, pageSize: logPageSize, setPageSize: setLogPageSize, totalItems: logTotalItems, setCurrentPage: setLogPage } = usePagination(filteredLogRows, 15)

  const onChartViewChange = (value: ChartView | null) => {
    if (value) {
      setChartView(value)
      setItemFilter('ALL')
    }
  }

  const currentViewLabel = chartViews.find((v) => v.value === chartView)?.label ?? ''

  return (
    <section className="space-y-4">
      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {currentViewLabel}
          </CardTitle>
          <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-3">
            <div className="space-y-1 w-full sm:w-auto">
              <Label className="text-xs text-slate-500">Chart</Label>
              <Select value={chartView} onValueChange={onChartViewChange}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartViews.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <Label className="text-xs text-slate-500">Filter</Label>
              <Select value={itemFilter} onValueChange={(v) => setItemFilter(v ?? 'ALL')}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={filterLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{filterLabel}</SelectItem>
                  {filterOptions.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {movementsQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Loading chart...
              </div>
            ) : chartData.labels.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No data available for {currentViewLabel.toLowerCase()}
              </div>
            ) : (
              <Line data={chartData} options={makeChartOptions()} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Movement Log Button */}
      <div className="flex items-center gap-3">
        <Button
          variant={showMovements ? 'default' : 'outline'}
          onClick={() => setShowMovements((prev) => !prev)}
          className="gap-2"
        >
          <ScrollText className="h-4 w-4" />
          {showMovements ? 'Hide Movement Log' : 'Movement Log'}
        </Button>
      </div>

      {/* Movement Log Section */}
      {showMovements && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Inventory Movement Log
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => exportToCsv(filteredLogRows)}
                disabled={filteredLogRows.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
                  <div className="space-y-2">
                    <Label>Movement Type</Label>
                    <Select value={logTypeFilter} onValueChange={(value) => setLogTypeFilter((value as MovementType | 'ALL') ?? 'ALL')}>
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
                    <Input id="log-search" value={logSearchText} onChange={(e) => setLogSearchText(e.target.value)} placeholder="item, reference..." />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="log-from-date">From</Label>
                    <Input id="log-from-date" type="date" value={logFromDate} onChange={(e) => setLogFromDate(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="log-to-date">To</Label>
                    <Input id="log-to-date" type="date" value={logToDate} onChange={(e) => setLogToDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Table */}
              {logQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading movement log...</p> : null}
              {logQuery.isError ? <p className="text-sm text-rose-600">Failed to load movement log.</p> : null}

              {!logQuery.isLoading && !logQuery.isError ? (
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
                      {logPaginatedItems.length ? (
                        logPaginatedItems.map((row) => (
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
                  {logTotalItems > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <Pagination
                        currentPage={logPage}
                        totalItems={logTotalItems}
                        pageSize={logPageSize}
                        onPageChange={setLogPage}
                        onPageSizeChange={setLogPageSize}
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
