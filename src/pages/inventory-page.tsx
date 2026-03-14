import { useMemo, useState } from 'react'
import { Trash2, Edit2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
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
import type { Unit } from '@/types/domain'

interface ProductOption {
  id: string
  name: string
  measured_unit: Unit
}

interface FormulaPreviewRow {
  raw_material_id: string
  quantity_required: number
  unit: Unit
  raw_materials: {
    name: string
    current_qty: number
  } | null
}

interface FinishedInventoryRow {
  id: string
  batch_no: string
  quantity: number
  unit: Unit
  produced_on: string | null
  products: {
    name: string
  } | null
}

const productsKey = ['products-options']
const finishedInventoryKey = ['finished-inventory']

const today = () => new Date().toISOString().slice(0, 10)

function generateBatchNo(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const counter = String(Math.floor(Math.random() * 9000) + 1000)
  return `BATCH-${dateStr}-${counter}`
}

async function fetchProducts(): Promise<ProductOption[]> {
  const { data, error } = await supabase.from('products').select('id,name,measured_unit').order('name')
  if (error) throw new Error(error.message)
  return (data as ProductOption[]) ?? []
}

async function fetchFormulaPreview(productId: string): Promise<FormulaPreviewRow[]> {
  if (!productId) return []

  const { data, error } = await supabase
    .from('product_formula_items')
    .select('raw_material_id,quantity_required,unit,raw_materials(name,current_qty)')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const rawRel = row.raw_materials
    const raw = Array.isArray(rawRel) ? rawRel[0] : rawRel

    return {
      raw_material_id: String(row.raw_material_id ?? ''),
      quantity_required: Number(row.quantity_required ?? 0),
      unit: (row.unit as Unit) ?? 'Piece',
      raw_materials: raw
        ? {
            name: String((raw as { name?: unknown }).name ?? ''),
            current_qty: Number((raw as { current_qty?: unknown }).current_qty ?? 0),
          }
        : null,
    }
  })
}

async function fetchFinishedInventory(): Promise<FinishedInventoryRow[]> {
  const { data, error } = await supabase
    .from('finished_inventory_batches')
    .select('id,batch_no,quantity,unit,produced_on,products(name)')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const productRel = row.products
    const product = Array.isArray(productRel) ? productRel[0] : productRel

    return {
      id: String(row.id ?? ''),
      batch_no: String(row.batch_no ?? ''),
      quantity: Number(row.quantity ?? 0),
      unit: (row.unit as Unit) ?? 'Piece',
      produced_on: row.produced_on ? String(row.produced_on) : null,
      products: product
        ? {
            name: String((product as { name?: unknown }).name ?? ''),
          }
        : null,
    }
  })
}

async function submitProduction(input: {
  productId: string
  batchNo: string
  quantity: number
  unit: Unit
  producedOn: string
}) {
  const { data, error } = await supabase.rpc('fn_production_transaction', {
    p_product_id: input.productId,
    p_batch_no: input.batchNo,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_produced_on: input.producedOn,
  })

  if (error) throw new Error(error.message)
  return data
}

export function InventoryPage() {
  const queryClient = useQueryClient()

  const [productId, setProductId] = useState('')
  const [batchNo, setBatchNo] = useState(generateBatchNo())
  const [quantity, setQuantity] = useState('')
  const [producedOn, setProducedOn] = useState(today())
  const [errorMsg, setErrorMsg] = useState('')

  // Edit Modal State
  const [editingBatch, setEditingBatch] = useState<FinishedInventoryRow | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editError, setEditError] = useState('')

  const productsQuery = useQuery({ queryKey: productsKey, queryFn: fetchProducts, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false })
  const formulaPreviewQuery = useQuery({
    queryKey: ['formula-preview', productId],
    queryFn: () => fetchFormulaPreview(productId),
    enabled: Boolean(productId),
  })
  const finishedInventoryQuery = useQuery({ queryKey: finishedInventoryKey, queryFn: fetchFinishedInventory, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false })

  const { paginatedItems, currentPage, pageSize, setPageSize, totalItems, setCurrentPage } = usePagination(finishedInventoryQuery.data ?? [], 10)

  const selectedProduct = useMemo(
    () => (productsQuery.data ?? []).find((item) => item.id === productId),
    [productsQuery.data, productId],
  )

  const quantityNumber = Number(quantity)
  const feasibilityRows = useMemo(() => {
    const qty = Number.isFinite(quantityNumber) && quantityNumber > 0 ? quantityNumber : 0
    return (formulaPreviewQuery.data ?? []).map((row) => {
      const needed = Number(row.quantity_required) * qty
      const available = Number(row.raw_materials?.current_qty ?? 0)
      return {
        materialName: row.raw_materials?.name ?? 'Unknown',
        unit: row.unit,
        needed,
        available,
        ok: available >= needed,
      }
    })
  }, [formulaPreviewQuery.data, quantityNumber])

  const allFeasible = feasibilityRows.length > 0 && feasibilityRows.every((row) => row.ok)

  const submitMutation = useMutation({
    mutationFn: submitProduction,
    onSuccess: async () => {
      setQuantity('')
      setBatchNo(generateBatchNo())
      setErrorMsg('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: finishedInventoryKey }),
        queryClient.invalidateQueries({ queryKey: ['formula-preview', productId] }),
        queryClient.invalidateQueries({ queryKey: ['raw-materials'] }),
      ])
    },
    onError: (error) => setErrorMsg(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase.rpc('fn_delete_production_transaction', { p_batch_id: batchId })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: finishedInventoryKey }),
        queryClient.invalidateQueries({ queryKey: productsKey }),
        queryClient.invalidateQueries({ queryKey: ['formula-preview', productId] }),
        queryClient.invalidateQueries({ queryKey: ['raw-materials'] }),
      ])
    },
    onError: (err: Error) => {
      alert(`Failed to delete production batch: ${err.message}`)
    },
  })

  const editMutation = useMutation({
    mutationFn: async (input: { batchId: string; newQty: number; newDate: string }) => {
      const { error } = await supabase.rpc('fn_edit_production_transaction', {
        p_batch_id: input.batchId,
        p_new_quantity: input.newQty,
        p_new_produced_on: input.newDate,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      closeEditModal()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: finishedInventoryKey }),
        queryClient.invalidateQueries({ queryKey: productsKey }),
        queryClient.invalidateQueries({ queryKey: ['formula-preview', productId] }),
        queryClient.invalidateQueries({ queryKey: ['raw-materials'] }),
      ])
    },
    onError: (err: Error) => {
      setEditError(`Failed to update production batch: ${err.message}`)
    },
  })

  const handleDeleteBatch = (batchId: string) => {
    if (!batchId) return
    if (window.confirm('Are you sure you want to delete this production batch? This will restore the used raw materials and remove the product stock.')) {
      deleteMutation.mutate(batchId)
    }
  }

  const openEditModal = (batch: FinishedInventoryRow) => {
    setEditingBatch(batch)
    setEditQty(String(batch.quantity))
    setEditDate(batch.produced_on ? batch.produced_on.slice(0, 10) : today())
    setEditError('')
  }

  const closeEditModal = () => {
    setEditingBatch(null)
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
      setEditError('Production date is required.')
      return
    }

    if (editingBatch) {
      editMutation.mutate({
        batchId: editingBatch.id,
        newQty: num,
        newDate: editDate,
      })
    }
  }

  const onSubmitProduction = () => {
    setErrorMsg('')
    if (!productId) {
      setErrorMsg('Select a product.')
      return
    }
    if (!batchNo.trim()) {
      setErrorMsg('Batch number is required.')
      return
    }
    if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
      setErrorMsg('Quantity must be greater than 0.')
      return
    }
    if (!producedOn) {
      setErrorMsg('Production date is required.')
      return
    }
    if (!allFeasible) {
      setErrorMsg('Production is blocked due to insufficient raw material stock.')
      return
    }

    submitMutation.mutate({
      productId,
      batchNo: batchNo.trim(),
      quantity: quantityNumber,
      unit: selectedProduct?.measured_unit ?? 'Piece',
      producedOn,
    })
  }

  return (
    <ModuleShell
      title="Finished Inventory"
      description="Track produced inventory and validate feasibility checks before updates."
      tableName="Finished Inventory"
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Run Production</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={(value) => setProductId(value ?? '')}>
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
              <Label htmlFor="batch-no">Batch (Auto-generated)</Label>
              <Input id="batch-no" value={batchNo} disabled className="bg-slate-100 dark:bg-slate-800" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="production-qty">Quantity</Label>
              <Input
                id="production-qty"
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="produced-on">Date</Label>
              <Input id="produced-on" type="date" value={producedOn} onChange={(e) => setProducedOn(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Feasibility Check</h4>
            {!productId ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Select a product to evaluate formula requirements.</p> : null}
            {productId && !feasibilityRows.length ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No formula rows found for this product.</p>
            ) : null}

            {feasibilityRows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Needed</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feasibilityRows.map((row) => (
                    <TableRow key={`${row.materialName}-${row.unit}`}>
                      <TableCell>{row.materialName}</TableCell>
                      <TableCell>
                        {row.needed.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell>
                        {row.available.toLocaleString()} {row.unit}
                      </TableCell>
                      <TableCell className={row.ok ? 'text-emerald-600' : 'text-rose-600'}>
                        {row.ok ? 'OK' : 'Insufficient'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="w-full sm:w-auto" type="button" onClick={onSubmitProduction} disabled={submitMutation.isPending || !allFeasible}>
              {submitMutation.isPending ? 'Saving...' : 'Save Production'}
            </Button>
            {errorMsg ? <p className="text-sm text-rose-600">{errorMsg}</p> : null}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Finished Inventory (Batch-wise)</h3>
          {finishedInventoryQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading finished inventory...</p> : null}
          {finishedInventoryQuery.isError ? (
            <p className="text-sm text-rose-600">Failed to load finished inventory.</p>
          ) : null}

          {!finishedInventoryQuery.isLoading && !finishedInventoryQuery.isError ? (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Produced On</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length ? (
                  paginatedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.products?.name ?? 'Unknown'}</TableCell>
                      <TableCell>{row.batch_no}</TableCell>
                      <TableCell>{Number(row.quantity).toLocaleString()}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.produced_on ? new Date(row.produced_on).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(row)}
                            className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            title="Edit production batch"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBatch(row.id)}
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            title="Delete production batch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-slate-500 dark:text-slate-400">
                      No finished inventory batches found.
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
        open={Boolean(editingBatch)}
        onCancel={closeEditModal}
        onConfirm={onEditSubmit}
        title="Edit Production Batch"
        description="Modify the quantity or date of this batch. The resulting product stock counts and consumed raw materials will be adjusted automatically according to the formula."
        confirmLabel="Save Changes"
        busy={editMutation.isPending}
      >
        <div className="mb-2 mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Product</Label>
              <Input value={editingBatch?.products?.name || ''} disabled className="dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Batch No</Label>
              <Input value={editingBatch?.batch_no || ''} disabled className="dark:bg-slate-800 dark:text-slate-200" />
            </div>
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
