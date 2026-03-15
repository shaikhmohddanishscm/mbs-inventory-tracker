import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
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
import { friendlyError } from '@/lib/friendly-error'
import type { MaterialType, Unit } from '@/types/domain'

interface RawMaterialOption {
  id: string
  name: string
  measured_unit: Unit
  type: MaterialType
}

interface ProductRow {
  id: string
  name: string
  measured_unit: Unit
}

interface FormulaItemRow {
  id: string
  raw_material_id: string
  quantity_required: number
  unit: Unit
  type: MaterialType
}

interface FormulaEditRow {
  rawMaterialId: string
  quantityRequired: string
  unit: Unit
  type: MaterialType
}

const units: Unit[] = ['Piece', 'Bottle']

const productsKey = ['products-list']
const rawMaterialsKey = ['raw-materials-options']
const formulaKeyBase = ['formula-items']

const newFormulaRow = (): FormulaEditRow => ({
  rawMaterialId: '',
  quantityRequired: '',
  unit: 'Piece',
  type: 'Core',
})

async function fetchProducts(): Promise<ProductRow[]> {
  const { data, error } = await supabase.from('products').select('id,name,measured_unit').order('name')
  if (error) throw new Error(error.message)
  return (data as ProductRow[]) ?? []
}

async function fetchRawMaterials(): Promise<RawMaterialOption[]> {
  const { data, error } = await supabase.from('raw_materials').select('id,name,measured_unit,type').order('name')
  if (error) throw new Error(error.message)
  return (data as RawMaterialOption[]) ?? []
}

async function createProduct(input: { name: string; measuredUnit: Unit }): Promise<string> {
  const { data, error } = await supabase.from('products').insert({
    name: input.name,
    measured_unit: input.measuredUnit,
  }).select('id').single()
  if (error) throw new Error(error.message)
  return data.id
}

async function updateProduct(input: { id: string; name: string; measuredUnit: Unit }): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      name: input.name,
      measured_unit: input.measuredUnit,
    })
    .eq('id', input.id)

  if (error) throw new Error(error.message)
}

async function deleteProduct(productId: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) throw new Error(error.message)
}

async function fetchFormulaItems(productId: string): Promise<FormulaItemRow[]> {
  if (!productId) return []
  const { data, error } = await supabase
    .from('product_formula_items')
    .select('id,raw_material_id,quantity_required,unit,type')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as FormulaItemRow[]) ?? []
}

async function saveFormulaItems(input: { productId: string; rows: FormulaEditRow[] }) {
  const { error: deleteError } = await supabase.from('product_formula_items').delete().eq('product_id', input.productId)
  if (deleteError) throw new Error(deleteError.message)

  if (!input.rows.length) return

  const payload = input.rows.map((row) => ({
    product_id: input.productId,
    raw_material_id: row.rawMaterialId,
    quantity_required: Number(row.quantityRequired),
    unit: row.unit,
    type: row.type,
  }))

  const { error } = await supabase.from('product_formula_items').insert(payload)
  if (error) throw new Error(error.message)
}

export function CombiMakerPage() {
  const queryClient = useQueryClient()

  // Create product state
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState<Unit>('Piece')
  const [createFormulaRows, setCreateFormulaRows] = useState<FormulaEditRow[]>([newFormulaRow()])

  // Edit product state
  const [editProductId, setEditProductId] = useState<string | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editProductUnit, setEditProductUnit] = useState<Unit>('Piece')

  // Formula state
  const [formulaProductId, setFormulaProductId] = useState<string | null>(null)
  const [formulaRows, setFormulaRows] = useState<FormulaEditRow[]>([newFormulaRow()])
  const [formulaEditing, setFormulaEditing] = useState(false)

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteTargetName, setDeleteTargetName] = useState('')

  const [errorMsg, setErrorMsg] = useState('')

  // Expanded formula view
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)

  const productsQuery = useQuery({ queryKey: productsKey, queryFn: fetchProducts, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false })

  const { paginatedItems: paginatedProducts, currentPage, pageSize, setPageSize, totalItems, setCurrentPage } = usePagination(productsQuery.data ?? [], 5)

  const rawMaterialsQuery = useQuery({ queryKey: rawMaterialsKey, queryFn: fetchRawMaterials, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false })

  const formulaQuery = useQuery({
    queryKey: [...formulaKeyBase, expandedProductId ?? formulaProductId ?? ''],
    queryFn: () => fetchFormulaItems(expandedProductId ?? formulaProductId ?? ''),
    enabled: Boolean(expandedProductId || formulaProductId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const materialsById = useMemo(() => {
    const map = new Map<string, RawMaterialOption>()
    for (const item of rawMaterialsQuery.data ?? []) map.set(item.id, item)
    return map
  }, [rawMaterialsQuery.data])

  const createProductMutation = useMutation({
    mutationFn: async (input: { name: string; measuredUnit: Unit; formulaRows: FormulaEditRow[] }) => {
      const productId = await createProduct({ name: input.name, measuredUnit: input.measuredUnit })
      // Save formula rows if any have a selected raw material
      const validFormula = input.formulaRows.filter((r) => r.rawMaterialId && Number(r.quantityRequired) > 0)
      if (validFormula.length > 0) {
        await saveFormulaItems({ productId, rows: validFormula })
      }
    },
    onSuccess: async () => {
      setProductName('')
      setProductUnit('Piece')
      setCreateFormulaRows([newFormulaRow()])
      setErrorMsg('')
      await queryClient.invalidateQueries({ queryKey: productsKey })
    },
    onError: (error) => setErrorMsg(friendlyError(error)),
  })

  const updateProductMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: async () => {
      setEditProductId(null)
      setEditProductName('')
      setEditProductUnit('Piece')
      setErrorMsg('')
      await queryClient.invalidateQueries({ queryKey: productsKey })
    },
    onError: (error) => setErrorMsg(friendlyError(error)),
  })

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      setDeleteTargetId(null)
      setDeleteTargetName('')
      setErrorMsg('')
      if (expandedProductId === deleteTargetId) setExpandedProductId(null)
      if (formulaProductId === deleteTargetId) setFormulaProductId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productsKey }),
        queryClient.invalidateQueries({ queryKey: formulaKeyBase }),
      ])
    },
    onError: (error) => setErrorMsg(friendlyError(error)),
  })

  const saveFormulaMutation = useMutation({
    mutationFn: saveFormulaItems,
    onSuccess: async () => {
      setErrorMsg('')
      setFormulaEditing(false)
      await queryClient.invalidateQueries({ queryKey: [...formulaKeyBase, formulaProductId ?? ''] })
    },
    onError: (error) => setErrorMsg(friendlyError(error)),
  })

  const onCreateProduct = () => {
    setErrorMsg('')
    const trimmed = productName.trim()
    if (!trimmed) {
      setErrorMsg('Product name is required.')
      return
    }
    // Validate formula rows that have content
    for (const row of createFormulaRows) {
      if (row.rawMaterialId) {
        const qty = Number(row.quantityRequired)
        if (!Number.isFinite(qty) || qty <= 0) {
          setErrorMsg('Quantity required must be greater than 0 for each formula row.')
          return
        }
      }
    }
    createProductMutation.mutate({ name: trimmed, measuredUnit: productUnit, formulaRows: createFormulaRows })
  }

  const updateCreateFormulaRow = (index: number, patch: Partial<FormulaEditRow>) => {
    setCreateFormulaRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const onCreateMaterialChange = (index: number, rawMaterialId: string) => {
    const material = materialsById.get(rawMaterialId)
    updateCreateFormulaRow(index, {
      rawMaterialId,
      unit: material?.measured_unit ?? 'Piece',
      type: material?.type ?? 'Core',
    })
  }

  const onStartEditProduct = (product: ProductRow) => {
    setEditProductId(product.id)
    setEditProductName(product.name)
    setEditProductUnit(product.measured_unit)
    setErrorMsg('')
  }

  const onSaveEditProduct = () => {
    if (!editProductId) return
    const trimmed = editProductName.trim()
    if (!trimmed) {
      setErrorMsg('Product name is required.')
      return
    }
    updateProductMutation.mutate({ id: editProductId, name: trimmed, measuredUnit: editProductUnit })
  }

  const onDeleteProduct = (product: ProductRow) => {
    setDeleteTargetId(product.id)
    setDeleteTargetName(product.name)
    setDeleteModalOpen(true)
  }

  const confirmDeleteProduct = () => {
    if (!deleteTargetId) return
    deleteProductMutation.mutate(deleteTargetId)
    setDeleteModalOpen(false)
  }

  const onToggleFormula = (productId: string) => {
    if (expandedProductId === productId) {
      setExpandedProductId(null)
      setFormulaProductId(null)
      setFormulaEditing(false)
    } else {
      setExpandedProductId(productId)
      setFormulaProductId(productId)
      setFormulaEditing(false)
    }
  }

  const onEditFormula = () => {
    const rows = (formulaQuery.data ?? []).map((item) => ({
      rawMaterialId: item.raw_material_id,
      quantityRequired: String(item.quantity_required ?? ''),
      unit: item.unit ?? 'Piece' as Unit,
      type: item.type ?? 'Core' as MaterialType,
    }))
    setFormulaRows(rows.length ? rows : [newFormulaRow()])
    setFormulaEditing(true)
  }

  const updateRow = (index: number, patch: Partial<FormulaEditRow>) => {
    setFormulaRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const onMaterialChange = (index: number, rawMaterialId: string) => {
    const material = materialsById.get(rawMaterialId)
    updateRow(index, {
      rawMaterialId,
      unit: material?.measured_unit ?? 'Piece',
      type: material?.type ?? 'Core',
    })
  }

  const onSaveFormula = () => {
    setErrorMsg('')
    if (!formulaProductId) {
      setErrorMsg('No product selected.')
      return
    }

    const validRows: FormulaEditRow[] = []
    for (const row of formulaRows) {
      if (!row.rawMaterialId) {
        setErrorMsg('Every formula row must have a raw material.')
        return
      }
      const qty = Number(row.quantityRequired)
      if (!Number.isFinite(qty) || qty <= 0) {
        setErrorMsg('Quantity required must be greater than 0 for each row.')
        return
      }
      validRows.push(row)
    }

    saveFormulaMutation.mutate({ productId: formulaProductId, rows: validRows })
  }

  return (
    <ModuleShell
      title="CombiMaker"
      description="Define product formulas using raw materials and required quantities."
      tableName="Combimaker"
    >
      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Product"
        description={
          deleteTargetName
            ? `Delete "${deleteTargetName}" and all linked formula rows? This action cannot be undone.`
            : 'Delete this product and all linked formula rows? This action cannot be undone.'
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        busy={deleteProductMutation.isPending}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteProduct}
      />

      <div className="space-y-6">
        {/* Create Product */}
        <CollapsibleSection title="Add Product">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Measured Unit</Label>
              <Select value={productUnit} onValueChange={(value) => setProductUnit((value as Unit) ?? 'Piece')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inline Formula Rows */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formula (Raw Materials Required)</h4>
              <Button type="button" size="sm" variant="outline" onClick={() => setCreateFormulaRows((prev) => [...prev, newFormulaRow()])}>
                + Add Row
              </Button>
            </div>
            <div className="space-y-2">
              {createFormulaRows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-12 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="md:col-span-5">
                    <Select value={row.rawMaterialId} onValueChange={(value) => onCreateMaterialChange(index, value ?? '')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select material">
                          {row.rawMaterialId ? materialsById.get(row.rawMaterialId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(rawMaterialsQuery.data ?? []).map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Qty"
                      value={row.quantityRequired}
                      onChange={(e) => updateCreateFormulaRow(index, { quantityRequired: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Input value={row.unit} disabled />
                  </div>
                  <div className="md:col-span-2">
                    <Input value={row.type} disabled />
                  </div>
                  <div className="flex items-center md:col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateFormulaRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                    >
                      -
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <Button className="w-full sm:w-auto" type="button" onClick={onCreateProduct} disabled={createProductMutation.isPending}>
              {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
          {errorMsg && !expandedProductId ? <p className="mt-3 text-sm text-rose-600">{errorMsg}</p> : null}
        </CollapsibleSection>

        {/* Products Table */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Products & Formulas</h3>

          {productsQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading products...</p> : null}
          {productsQuery.isError ? <p className="text-sm text-rose-600">Failed to load products.</p> : null}

          {!productsQuery.isLoading && !productsQuery.isError ? (
            <div className="space-y-3">
              {totalItems === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No products created yet. Add a product above.</p>
              ) : (
                <>
                {paginatedProducts.map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50 overflow-hidden">
                    {/* Product Row */}
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      {editProductId === product.id ? (
                        <>
                          <Input
                            value={editProductName}
                            onChange={(e) => setEditProductName(e.target.value)}
                            className="w-full sm:w-[200px]"
                          />
                          <Select value={editProductUnit} onValueChange={(v) => setEditProductUnit(v as Unit)}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={onSaveEditProduct} disabled={updateProductMutation.isPending}>
                            {updateProductMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditProductId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{product.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Unit: {product.measured_unit}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => onToggleFormula(product.id)}>
                              {expandedProductId === product.id ? 'Hide Formula' : 'View Formula'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onStartEditProduct(product)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => onDeleteProduct(product)}>
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Expanded Formula Section */}
                    {expandedProductId === product.id && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/30">
                        {formulaQuery.isLoading ? (
                          <p className="text-sm text-slate-500">Loading formula...</p>
                        ) : !formulaEditing ? (
                          <>
                            {(formulaQuery.data ?? []).length === 0 ? (
                              <p className="text-sm text-slate-500 dark:text-slate-400">No formula defined yet.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Raw Material</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Type</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(formulaQuery.data ?? []).map((item) => (
                                    <TableRow key={item.id}>
                                      <TableCell>{materialsById.get(item.raw_material_id)?.name ?? 'Unknown'}</TableCell>
                                      <TableCell>{Number(item.quantity_required).toLocaleString()}</TableCell>
                                      <TableCell>{item.unit}</TableCell>
                                      <TableCell>{item.type}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                            <div className="mt-3">
                              <Button size="sm" variant="outline" onClick={onEditFormula}>
                                Edit Formula
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {formulaRows.map((row, index) => (
                                <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-12 dark:border-slate-700 dark:bg-slate-900/70">
                                  <div className="space-y-2 md:col-span-5">
                                    <Label>Raw Material</Label>
                                    <Select value={row.rawMaterialId} onValueChange={(value) => onMaterialChange(index, value ?? '')}>
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select material">
                                          {row.rawMaterialId ? materialsById.get(row.rawMaterialId)?.name : undefined}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(rawMaterialsQuery.data ?? []).map((material) => (
                                          <SelectItem key={material.id} value={material.id}>
                                            {material.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Qty</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      value={row.quantityRequired}
                                      onChange={(e) => updateRow(index, { quantityRequired: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Unit</Label>
                                    <Input value={row.unit} disabled />
                                  </div>
                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Type</Label>
                                    <Input value={row.type} disabled />
                                  </div>
                                  <div className="flex items-end md:col-span-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => setFormulaRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                                    >
                                      -
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <Button type="button" variant="outline" onClick={() => setFormulaRows((prev) => [...prev, newFormulaRow()])}>
                                + Add Row
                              </Button>
                              <Button type="button" onClick={onSaveFormula} disabled={saveFormulaMutation.isPending}>
                                {saveFormulaMutation.isPending ? 'Saving...' : 'Save Formula'}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setFormulaEditing(false)}>
                                Cancel
                              </Button>
                            </div>
                            {errorMsg && expandedProductId ? <p className="mt-3 text-sm text-rose-600">{errorMsg}</p> : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
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
              )}
            </div>
          ) : null}
        </section>
      </div>
    </ModuleShell>
  )
}
