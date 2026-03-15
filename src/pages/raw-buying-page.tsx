import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Button } from '@/components/ui/button'
import { Trash2, Edit2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Combobox } from '@/components/ui/combobox'
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
import type { MaterialType, Unit } from '@/types/domain'

/* ─── Types ─── */
interface RawMaterialOption {
  id: string
  name: string
  measured_unit: Unit
  type: MaterialType
  current_qty: number
}

interface MovementRow {
  id: string
  reference_id: string
  item_name: string
  quantity: number
  unit: Unit
  occurred_at: string
}

interface BuyingLineState {
  rawMaterialId: string
  quantity: string
  unit: Unit
}

interface RawBuyingSubmitInput {
  purchaseDate: string
  lines: Array<{
    rawMaterialId: string
    quantity: number
    unit: Unit
  }>
}

interface CreateRawMaterialInput {
  name: string
  measuredUnit: Unit
  type: MaterialType
}

interface UpdateRawMaterialInput extends CreateRawMaterialInput {
  id: string
}

/* ─── Constants ─── */
const rawMaterialsKey = ['raw-materials-options']
const recentMovementsKey = ['recent-raw-buying-movements']
const measuredUnits: Unit[] = ['Piece', 'Bottle']
const materialTypes: MaterialType[] = ['Core', 'Packaging']
const unitFallback: Unit = 'Piece'
const STALE_TIME = 2 * 60 * 1000

const makeLine = (): BuyingLineState => ({
  rawMaterialId: '',
  quantity: '',
  unit: unitFallback,
})

const today = () => new Date().toISOString().slice(0, 10)

/* ─── API ─── */
async function fetchRawMaterialOptions(): Promise<RawMaterialOption[]> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id,name,measured_unit,type,current_qty')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as RawMaterialOption[]) ?? []
}

async function fetchRecentRawBuyingMovements(): Promise<MovementRow[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id,reference_id,item_name,quantity,unit,occurred_at')
    .eq('movement_type', 'RAW_BUYING')
    .order('occurred_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return (data as MovementRow[]) ?? []
}

async function submitRawBuying(input: RawBuyingSubmitInput) {
  const { data, error } = await supabase.rpc('fn_raw_buying_transaction', {
    p_purchase_date: input.purchaseDate,
    p_lines: input.lines.map((l) => ({
      raw_material_id: l.rawMaterialId,
      quantity: l.quantity,
      auto_unit: l.unit,
    })),
  })

  if (error) throw new Error(error.message)
  return data
}

async function createRawMaterial(input: CreateRawMaterialInput): Promise<void> {
  const { error } = await supabase.from('raw_materials').insert({
    name: input.name,
    measured_unit: input.measuredUnit,
    type: input.type,
    current_qty: 0,
  })
  if (error) throw new Error(error.message)
}

async function updateRawMaterial(input: UpdateRawMaterialInput): Promise<void> {
  const { error } = await supabase
    .from('raw_materials')
    .update({
      name: input.name,
      measured_unit: input.measuredUnit,
      type: input.type,
    })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
}

async function deleteRawMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('raw_materials').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/* ─── Component ─── */
export function RawBuyingPage() {
  const queryClient = useQueryClient()

  // Buying form state
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [lines, setLines] = useState<BuyingLineState[]>([makeLine()])
  const [formError, setFormError] = useState('')

  // Raw material modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [rmName, setRmName] = useState('')
  const [rmUnit, setRmUnit] = useState<Unit>('Piece')
  const [rmType, setRmType] = useState<MaterialType>('Core')
  const [rmError, setRmError] = useState('')
  const [editingRmId, setEditingRmId] = useState<string | null>(null)

  // Edit Purchase Modal State
  const [editingPurchase, setEditingPurchase] = useState<MovementRow | null>(null)
  const [editPurchaseQty, setEditPurchaseQty] = useState('')
  const [editPurchaseDate, setEditPurchaseDate] = useState('')
  const [editPurchaseError, setEditPurchaseError] = useState('')

  // Delete raw material state
  const [deleteTarget, setDeleteTarget] = useState<RawMaterialOption | null>(null)

  // Queries
  const rawMaterialsQuery = useQuery({
    queryKey: rawMaterialsKey,
    queryFn: fetchRawMaterialOptions,
    staleTime: STALE_TIME,
  })

  const recentMovementsQuery = useQuery({
    queryKey: recentMovementsKey,
    queryFn: fetchRecentRawBuyingMovements,
    staleTime: STALE_TIME,
  })

  // Pagination for raw materials modal table
  const { 
    paginatedItems: paginatedRmItems, 
    currentPage: currentRmPage, 
    pageSize: rmPageSize, 
    setPageSize: setRmPageSize,
    totalItems: totalRmItems, 
    setCurrentPage: setCurrentRmPage 
  } = usePagination(rawMaterialsQuery.data ?? [], 5)

  // Pagination for recent movements
  const { 
    paginatedItems: paginatedMovements, 
    currentPage: currentMovementPage, 
    pageSize: movementPageSize, 
    setPageSize: setMovementPageSize,
    totalItems: totalMovementItems, 
    setCurrentPage: setCurrentMovementPage 
  } = usePagination(recentMovementsQuery.data ?? [], 5)

  const materialsById = useMemo(() => {
    const map = new Map<string, RawMaterialOption>()
    for (const item of rawMaterialsQuery.data ?? []) {
      map.set(item.id, item)
    }
    return map
  }, [rawMaterialsQuery.data])

  const comboboxOptions = useMemo(() => {
    return (rawMaterialsQuery.data ?? []).map((m) => ({
      value: m.id,
      label: m.name,
    }))
  }, [rawMaterialsQuery.data])

  const hasRawMaterials = (rawMaterialsQuery.data?.length ?? 0) > 0

  // Mutations
  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: rawMaterialsKey }),
      queryClient.invalidateQueries({ queryKey: recentMovementsKey }),
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] }),
    ])
  }

  const submitMutation = useMutation({
    mutationFn: submitRawBuying,
    onSuccess: async () => {
      setLines([makeLine()])
      setFormError('')
      await invalidateAll()
    },
    onError: (error) => setFormError(error.message),
  })

  const createRmMutation = useMutation({
    mutationFn: createRawMaterial,
    onSuccess: async () => {
      resetRmForm()
      await invalidateAll()
    },
    onError: (error) => setRmError(error.message),
  })

  const updateRmMutation = useMutation({
    mutationFn: updateRawMaterial,
    onSuccess: async () => {
      resetRmForm()
      await invalidateAll()
    },
    onError: (error) => setRmError(error.message),
  })

  const deleteRmMutation = useMutation({
    mutationFn: deleteRawMaterial,
    onSuccess: async () => {
      setDeleteTarget(null)
      await invalidateAll()
    },
    onError: (error) => setRmError(error.message),
  })

  const deletePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase.rpc('fn_delete_raw_buying_transaction', { p_purchase_id: purchaseId })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      await invalidateAll()
    },
    onError: (err: Error) => {
      alert(`Failed to delete raw buying transaction: ${err.message}`)
    },
  })

  const editPurchaseMutation = useMutation({
    mutationFn: async (input: { movementId: string; newQty: number; newDate: string }) => {
      const { error } = await supabase.rpc('fn_edit_raw_buying_transaction', {
        p_movement_id: input.movementId,
        p_new_quantity: input.newQty,
        p_new_purchase_date: input.newDate,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      closeEditPurchaseModal()
      await invalidateAll()
    },
    onError: (err: Error) => {
      setEditPurchaseError(`Failed to update purchase: ${err.message}`)
    },
  })

  const handleDeletePurchase = (purchaseId: string) => {
    if (!purchaseId) return
    if (window.confirm('Are you sure you want to delete this raw buying transaction? This will remove the added raw material stock.')) {
      deletePurchaseMutation.mutate(purchaseId)
    }
  }

  const openEditPurchaseModal = (movement: MovementRow) => {
    setEditingPurchase(movement)
    setEditPurchaseQty(String(movement.quantity))
    setEditPurchaseDate(movement.occurred_at.slice(0, 10))
    setEditPurchaseError('')
  }

  const closeEditPurchaseModal = () => {
    setEditingPurchase(null)
    setEditPurchaseQty('')
    setEditPurchaseDate('')
    setEditPurchaseError('')
  }

  const onEditPurchaseSubmit = () => {
    setEditPurchaseError('')
    const num = Number(editPurchaseQty)
    if (!Number.isFinite(num) || num <= 0) {
      setEditPurchaseError('Quantity must be greater than zero.')
      return
    }
    if (!editPurchaseDate) {
      setEditPurchaseError('Purchase date is required.')
      return
    }

    if (editingPurchase) {
      editPurchaseMutation.mutate({
        movementId: editingPurchase.id,
        newQty: num,
        newDate: editPurchaseDate,
      })
    }
  }

  const resetRmForm = () => {
    setRmName('')
    setRmUnit('Piece')
    setRmType('Core')
    setRmError('')
    setEditingRmId(null)
  }

  // Buying form handlers
  const updateLine = (index: number, patch: Partial<BuyingLineState>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const onRawMaterialChange = (index: number, rawMaterialId: string) => {
    const material = materialsById.get(rawMaterialId)
    updateLine(index, {
      rawMaterialId,
      unit: material?.measured_unit ?? unitFallback,
    })
  }

  const addLine = () => setLines((prev) => [...prev, makeLine()])

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const onSubmitBuying = () => {
    setFormError('')
    if (!hasRawMaterials) {
      setFormError('No raw materials. Add one using the + button above.')
      return
    }
    if (!purchaseDate) {
      setFormError('Purchase date is required.')
      return
    }
    const parsedLines: RawBuyingSubmitInput['lines'] = []
    for (const line of lines) {
      if (!line.rawMaterialId) {
        setFormError('Please select a raw material for every line.')
        return
      }
      const qty = Number(line.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError('Each line quantity must be greater than 0.')
        return
      }
      parsedLines.push({ rawMaterialId: line.rawMaterialId, quantity: qty, unit: line.unit })
    }
    submitMutation.mutate({ purchaseDate, lines: parsedLines })
  }

  // Raw material CRUD handlers
  const onSaveRawMaterial = () => {
    const trimmed = rmName.trim()
    if (!trimmed) {
      setRmError('Name is required.')
      return
    }

    if (editingRmId) {
      updateRmMutation.mutate({ id: editingRmId, name: trimmed, measuredUnit: rmUnit, type: rmType })
    } else {
      createRmMutation.mutate({ name: trimmed, measuredUnit: rmUnit, type: rmType })
    }
  }

  const startEditRm = (row: RawMaterialOption) => {
    setEditingRmId(row.id)
    setRmName(row.name)
    setRmUnit(row.measured_unit)
    setRmType(row.type)
    setRmError('')
  }

  const confirmDeleteRm = () => {
    if (!deleteTarget) return
    deleteRmMutation.mutate(deleteTarget.id)
  }

  const isSaving = createRmMutation.isPending || updateRmMutation.isPending

  return (
    <ModuleShell
      title="Raw Material"
      description="Manage raw materials and capture incoming material purchases."
      tableName="Raw Material"
    >
      {/* Delete Raw Material Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Raw Material"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="destructive"
        busy={deleteRmMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRm}
      />

      {/* Raw Material Management Modal — form + table */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl max-h-[85vh] overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Raw Materials</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetRmForm()
                  setModalOpen(false)
                }}
              >
                ✕
              </Button>
            </div>

            {/* Add / Edit Form */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editingRmId ? 'Edit Material' : 'Add New Material'}
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="modal-rm-name">Name</Label>
                  <Input
                    id="modal-rm-name"
                    placeholder="Material name"
                    value={rmName}
                    onChange={(e) => setRmName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label>Measured Unit</Label>
                  <Select value={rmUnit} onValueChange={(v) => setRmUnit(v as Unit)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {measuredUnits.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={rmType} onValueChange={(v) => setRmType(v as MaterialType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {materialTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button type="button" onClick={onSaveRawMaterial} disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingRmId ? 'Update Material' : 'Add Material'}
                </Button>
                {editingRmId && (
                  <Button type="button" variant="outline" onClick={resetRmForm}>
                    Cancel Edit
                  </Button>
                )}
                {rmError ? <p className="text-sm text-rose-600">{rmError}</p> : null}
              </div>
            </div>

            {/* Materials Table inside modal */}
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Measured Unit</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRmItems.length ? (
                    paginatedRmItems.map((row) => (
                      <TableRow key={row.id} className={editingRmId === row.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.measured_unit}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => startEditRm(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => { setModalOpen(false); setDeleteTarget(row) }}
                              disabled={deleteRmMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="text-slate-500 dark:text-slate-400" colSpan={4}>
                        No raw materials yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {totalRmItems > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <Pagination
                    currentPage={currentRmPage}
                    totalItems={totalRmItems}
                    pageSize={rmPageSize}
                    onPageChange={setCurrentRmPage}
                    onPageSizeChange={setRmPageSize}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Raw Material Buying Form */}
        <CollapsibleSection title="Raw Material Buying">
          <div className="flex justify-end mb-3">
            <Button type="button" onClick={() => setModalOpen(true)} className="shrink-0">
              + Manage Materials
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-5 md:items-end dark:border-slate-700 dark:bg-slate-900/70">
                <div className="space-y-1">
                  <Label>Raw Material</Label>
                  <Combobox
                    options={comboboxOptions}
                    value={line.rawMaterialId}
                    onValueChange={(value) => onRawMaterialChange(index, value)}
                    placeholder="Type or select material..."
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Input value={line.unit} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="h-9 w-9 p-0" onClick={() => removeLine(index)}>
                    -
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={addLine}>
              + Add More
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="button"
              onClick={onSubmitBuying}
              disabled={submitMutation.isPending || rawMaterialsQuery.isLoading || !hasRawMaterials}
            >
              {submitMutation.isPending ? 'Saving...' : 'Save Raw Buying'}
            </Button>
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
        </CollapsibleSection>

        {/* Recent Movements */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Raw Material Movements</h3>

          {recentMovementsQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading movements...</p> : null}
          {recentMovementsQuery.isError ? <p className="text-sm text-rose-600">Failed to load movements.</p> : null}

          {!recentMovementsQuery.isLoading && !recentMovementsQuery.isError ? (
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
                {paginatedMovements.length ? (
                  paginatedMovements.map((row) => (
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
                            onClick={() => openEditPurchaseModal(row)}
                            className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                            title="Edit purchase line"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePurchase(row.reference_id)}
                            disabled={deletePurchaseMutation.isPending}
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            title="Delete purchase"
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
                      No raw buying movements yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalMovementItems > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                <Pagination
                  currentPage={currentMovementPage}
                  totalItems={totalMovementItems}
                  pageSize={movementPageSize}
                  onPageChange={setCurrentMovementPage}
                  onPageSizeChange={setMovementPageSize}
                />
              </div>
            )}
            </>
          ) : null}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(editingPurchase)}
        onCancel={closeEditPurchaseModal}
        onConfirm={onEditPurchaseSubmit}
        title="Edit Purchase Transaction"
        description="Modify the quantity or date of this purchase. The raw material stock counts will be corrected automatically by the difference."
        confirmLabel="Save Changes"
        busy={editPurchaseMutation.isPending}
      >
        <div className="mb-2 mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Raw Material Name</Label>
            <Input value={editingPurchase?.item_name || ''} disabled className="dark:bg-slate-800 dark:text-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Quantity</Label>
              <Input
                type="number"
                min="1"
                step="any"
                value={editPurchaseQty}
                onChange={(e) => setEditPurchaseQty(e.target.value)}
                className="dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Date</Label>
              <Input
                type="date"
                value={editPurchaseDate}
                onChange={(e) => setEditPurchaseDate(e.target.value)}
                className="dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
          {editPurchaseError && <p className="text-sm text-rose-600">{editPurchaseError}</p>}
        </div>
      </ConfirmModal>

    </ModuleShell>
  )
}
