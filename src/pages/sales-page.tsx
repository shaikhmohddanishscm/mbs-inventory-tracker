import { useMemo, useState } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/ui/confirm-modal'

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
import { friendlyError } from '@/lib/friendly-error'
import type { Unit } from '@/types/domain'

interface ProductOption {
  id: string
  name: string
  measured_unit: Unit
}

interface SalesMovementRow {
  id: string
  reference_id: string
  item_name: string
  quantity: number
  unit: Unit
  occurred_at: string
}

const productsKey = ['products']

const today = () => new Date().toISOString().slice(0, 10)

async function fetchProducts(): Promise<ProductOption[]> {
  const { data, error } = await supabase.from('products').select('id,name,measured_unit').order('name')
  if (error) throw new Error(error.message)
  return (data as ProductOption[]) ?? []
}

async function fetchProductStock(productId: string): Promise<number> {
  if (!productId) return 0
  const { data, error } = await supabase
    .from('finished_inventory_batches')
    .select('quantity')
    .eq('product_id', productId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Number(data?.quantity ?? 0)
}

async function fetchRecentSalesMovements(): Promise<SalesMovementRow[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,reference_id,item_name,quantity,unit,occurred_at')
    .eq('movement_type', 'SALES')
    .order('occurred_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return (data as SalesMovementRow[]) ?? []
}

async function submitSales(input: {
  productId: string
  quantity: number
  unit: Unit
  salesDate: string
}) {
  const { data, error } = await supabase.rpc('fn_sales_transaction', {
    p_product_id: input.productId,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_sales_date: input.salesDate,
  })

  if (error) throw new Error(error.message)
  return data
}

export function SalesPage() {
  const queryClient = useQueryClient()

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [salesDate, setSalesDate] = useState(today())
  const [errorMsg, setErrorMsg] = useState('')

  // Edit Modal State
  const [editingSale, setEditingSale] = useState<SalesMovementRow | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editError, setEditError] = useState('')

  const productsQuery = useQuery({ queryKey: productsKey, queryFn: fetchProducts, staleTime: 2 * 60 * 1000 })

  const stockQuery = useQuery({
    queryKey: ['product-stock', productId],
    queryFn: () => fetchProductStock(productId),
    enabled: Boolean(productId),
  })

  const movementsQuery = useQuery({
    queryKey: ['recent-sales-movements'],
    queryFn: fetchRecentSalesMovements,
  })

  const { paginatedItems, currentPage, pageSize, setPageSize, totalItems, setCurrentPage } = usePagination(movementsQuery.data ?? [], 5)

  const selectedProduct = useMemo(
    () => (productsQuery.data ?? []).find((item) => item.id === productId),
    [productsQuery.data, productId],
  )

  const qtyNum = Number(quantity)
  const isValidQty = Number.isFinite(qtyNum) && qtyNum > 0
  const availableQty = stockQuery.data ?? 0
  const canSell = isValidQty && availableQty >= qtyNum

  const submitMutation = useMutation({
    mutationFn: submitSales,
    onSuccess: async () => {
      setQuantity('')
      setErrorMsg('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product-stock', productId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['finished-inventory'] }),
      ])
    },
    onError: (error) => setErrorMsg(friendlyError(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc('fn_delete_sales_transaction', { p_sale_id: saleId })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsKey }),
        queryClient.invalidateQueries({ queryKey: ['product-stock', productId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['finished-inventory'] }),
      ])
    },
    onError: (err: Error) => {
      alert(`Failed to delete sale: ${friendlyError(err)}`)
    },
  })

  const editMutation = useMutation({
    mutationFn: async (input: { saleId: string; newQty: number; newDate: string }) => {
      const { error } = await supabase.rpc('fn_edit_sales_transaction', {
        p_sale_id: input.saleId,
        p_new_quantity: input.newQty,
        p_new_sales_date: input.newDate,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      closeEditModal()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsKey }),
        queryClient.invalidateQueries({ queryKey: ['product-stock', productId] }),
        queryClient.invalidateQueries({ queryKey: ['recent-sales-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['finished-inventory'] }),
      ])
    },
    onError: (err: Error) => {
      setEditError(friendlyError(err))
    },
  })

  const handleDelete = (saleId: string) => {
    if (!saleId) return
    if (window.confirm('Are you sure you want to delete this sales transaction? This will restore the product stock.')) {
      deleteMutation.mutate(saleId)
    }
  }

  const openEditModal = (sale: SalesMovementRow) => {
    setEditingSale(sale)
    setEditQty(String(sale.quantity))
    setEditDate(sale.occurred_at.slice(0, 10))
    setEditError('')
  }

  const closeEditModal = () => {
    setEditingSale(null)
    setEditQty('')
    setEditDate('')
    setEditError('')
  }

  const onEditSubmit = () => {
    setEditError('')
    const num = Number(editQty)
    if (!Number.isFinite(num) || num <= 0) {
      setEditError('Quantity must be greater than zero.')
      return
    }
    if (!editDate) {
      setEditError('Sales date is required.')
      return
    }

    if (editingSale) {
      editMutation.mutate({
        saleId: editingSale.reference_id,
        newQty: num,
        newDate: editDate,
      })
    }
  }

  const onSubmit = () => {
    setErrorMsg('')

    if (!productId) {
      setErrorMsg('Select a product.')
      return
    }
    if (!isValidQty) {
      setErrorMsg('Quantity must be greater than 0.')
      return
    }
    if (!canSell) {
      setErrorMsg('Sales quantity exceeds available inventory.')
      return
    }
    if (!salesDate) {
      setErrorMsg('Sales date is required.')
      return
    }

    submitMutation.mutate({
      productId,
      quantity: qtyNum,
      unit: selectedProduct?.measured_unit ?? 'Piece',
      salesDate,
    })
  }

  return (
    <ModuleShell
      title="Sales"
      description="Record outgoing finished goods with quantity checks and dated entries."
      tableName="Sales"
    >
      <div className="space-y-6">
        <CollapsibleSection title="Record Sales Entry">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={productId}
                onValueChange={(value) => {
                  setProductId(value ?? '')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product">
                    {productId ? selectedProduct?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(productsQuery.data ?? []).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sales-qty">Quantity</Label>
              <Input
                id="sales-qty"
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sales-date">Date</Label>
              <Input id="sales-date" type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sales Validation</h4>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Available: <strong>{availableQty.toLocaleString()}</strong> {selectedProduct?.measured_unit ?? 'Piece'}
            </p>
            <p className={`mt-1 text-sm ${canSell ? 'text-emerald-600' : 'text-rose-600'}`}>
              {canSell ? 'Sale is possible.' : 'Sale is blocked.'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="w-full sm:w-auto" type="button" onClick={onSubmit} disabled={submitMutation.isPending || !canSell}>
              {submitMutation.isPending ? 'Saving...' : 'Save Sales Entry'}
            </Button>
            {errorMsg ? <p className="text-sm text-rose-600">{errorMsg}</p> : null}
          </div>
        </CollapsibleSection>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Sales Movements</h3>

          {movementsQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading sales history...</p> : null}
          {movementsQuery.isError ? <p className="text-sm text-rose-600">Failed to load sales history.</p> : null}

          {!movementsQuery.isLoading && !movementsQuery.isError ? (
            <>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length ? (
                  paginatedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.item_name}</TableCell>
                      <TableCell>{Number(row.quantity).toLocaleString()}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{new Date(row.occurred_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(row)}
                            className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            title="Edit sale"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(row.reference_id)}
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            title="Delete sale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-slate-500 dark:text-slate-400" colSpan={5}>
                      No sales movements yet.
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

      <ConfirmModal
        open={Boolean(editingSale)}
        onCancel={closeEditModal}
        onConfirm={onEditSubmit}
        title="Edit Sales Transaction"
        description="Modify the quantity or date of this past sale. The resulting stock counts and inventory movements will be adjusted automatically."
        confirmLabel="Save Changes"
        busy={editMutation.isPending}
      >
        <div className="mb-2 mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Item Name</Label>
            <Input value={editingSale?.item_name || ''} disabled className="dark:bg-slate-800 dark:text-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Quantity</Label>
              <Input
                type="number"
                min="1"
                step="any"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                className="dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Date</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
          {editError && <p className="text-sm text-rose-600">{editError}</p>}
        </div>
      </ConfirmModal>

    </ModuleShell>
  )
}
