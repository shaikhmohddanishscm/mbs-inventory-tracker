import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

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

type ChartView = 'RAW_BUYING' | 'PRODUCTION' | 'SALES'

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

export function DashboardPage() {
  const [chartView, setChartView] = useState<ChartView>('RAW_BUYING')
  const [itemFilter, setItemFilter] = useState('ALL')

  // Fetch movements for the selected chart view
  const movementsQuery = useQuery({
    queryKey: ['dashboard-movements', chartView],
    queryFn: () => fetchMovements(chartView),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Fetch filter options based on chart view
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

  const onChartViewChange = (value: ChartView | null) => {
    if (value) {
      setChartView(value)
      setItemFilter('ALL') // Reset item filter when chart changes
    }
  }

  const currentViewLabel = chartViews.find((v) => v.value === chartView)?.label ?? ''

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {currentViewLabel}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Chart</Label>
              <Select value={chartView} onValueChange={onChartViewChange}>
                <SelectTrigger className="w-[220px]">
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
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Filter</Label>
              <Select value={itemFilter} onValueChange={(v) => setItemFilter(v ?? 'ALL')}>
                <SelectTrigger className="w-[180px]">
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
    </section>
  )
}
