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
import { friendlyError } from '@/lib/friendly-error'
import type { MaterialType, Unit } from '@/types/domain'

/* ─── Types ─── */
interface RawMaterial {
  id: string
  name: string
  measured_unit: Unit
  type: MaterialType
}

interface DetailRow {
  id: string
  raw_material_id: string
  quantity: number
  unit: Unit
  purchase_date: string
  raw_materials: { name: string } | null
}

interface BuyingLineState {
  rawMaterialId: string
  quantity: string
  unit: Unit
}

/* ─── Constants ─── */
const rawMaterialsKey = ['raw-materials']
const detailKey = ['raw-material-details']
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
async function fetchRawMaterials(): Promise<RawMaterial[]> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id,name,measured_unit,type')
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as RawMaterial[]) ?? []
}

async function fetchDetails(): Promise<DetailRow[]> {
  const { data, error } = await supabase
    .from('raw_material_details')
    .select('id,raw_material_id,quantity,unit,purchase_date,raw_materials(name)')
    .order('purchase_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as unknown as DetailRow[]) ?? []
}

/* ─── Component ─── */
export function RawBuyingPage() {
  const queryClient = useQueryClient()

  // ── Buying form ────────────────────────────────────────────────────────────
  const [purchaseDate, setPurchaseDate] = useState(today())
  const [lines, setLines] = useState<BuyingLineState[]>([makeLine()])
  const [formError, setFormError] = useState('')

  // ── Manage Materials modal ─────────────────────────────────────────────────
  const [manageMaterialsOpen, setManageMaterialsOpen] = useState(false)
  const [rmName, setRmName] = useState('')
  const [rmUnit, setRmUnit] = useState<Unit>('Piece')
  const [rmType, setRmType] = useState<MaterialType>('Core')
  const [rmError, setRmError] = useState('')
  const [editingRmId, setEditingRmId] = useState<string | null>(null)
  const [deleteRmTarget, setDeleteRmTarget] = useState<RawMaterial | null>(null)

  // ── Edit detail modal ──────────────────────────────────────────────────────
  const [editingDetail, setEditingDetail] = useState<DetailRow | null>(null)
  const [editDetailRmId, setEditDetailRmId] = useState('')
  const [editDetailQty, setEditDetailQty] = useState('')
  const [editDetailDate, setEditDetailDate] = useState('')
  const [editDetailError, setEditDetailError] = useState('')

  // ── Delete detail confirm ──────────────────────────────────────────────────
  const [deleteDetailTarget, setDeleteDetailTarget] = useState<DetailRow | null>(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const rmQuery = useQuery({ queryKey: rawMaterialsKey, queryFn: fetchRawMaterials, staleTime: STALE_TIME })
  const detailQuery = useQuery({ queryKey: detailKey, queryFn: fetchDetails, staleTime: STALE_TIME })

  const {
    paginatedItems: paginatedRm, currentPage: rmPage,
    pageSize: rmPageSize, setPageSize: setRmPageSize,
    totalItems: totalRm, setCurrentPage: setRmPage,
  } = usePagination(rmQuery.data ?? [], 5)

  const {
    paginatedItems: paginatedDetail, currentPage: detailPage,
    pageSize: detailPageSize, setPageSize: setDetailPageSize,
    totalItems: totalDetail, setCurrentPage: setDetailPage,
  } = usePagination(detailQuery.data ?? [], 10)

  const materialsById = useMemo(() => {
    const map = new Map<string, RawMaterial>()
    for (const m of rmQuery.data ?? []) map.set(m.id, m)
    return map
  }, [rmQuery.data])

  const comboboxOptions = useMemo(
    () => (rmQuery.data ?? []).map((m) => ({ value: m.id, label: m.name })),
    [rmQuery.data],
  )

  const hasRawMaterials = (rmQuery.data?.length ?? 0) > 0

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: rawMaterialsKey }),
      queryClient.invalidateQueries({ queryKey: detailKey }),
    ])
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createRmMutation = useMutation({
    mutationFn: async (input: { name: string; measuredUnit: Unit; type: MaterialType }) => {
      const { error } = await supabase.from('raw_materials').insert({
        name: input.name, measured_unit: input.measuredUnit, type: input.type,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { resetRmForm(); await invalidateAll() },
    onError: (e) => setRmError(friendlyError(e)),
  })

  const updateRmMutation = useMutation({
    mutationFn: async (input: { id: string; name: string; measuredUnit: Unit; type: MaterialType }) => {
      const { error } = await supabase.from('raw_materials')
        .update({ name: input.name, measured_unit: input.measuredUnit, type: input.type })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { resetRmForm(); await invalidateAll() },
    onError: (e) => setRmError(friendlyError(e)),
  })

  const deleteRmMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('raw_materials').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { setDeleteRmTarget(null); await invalidateAll() },
    onError: (e) => setRmError(friendlyError(e)),
  })

  const addDetailMutation = useMutation({
    mutationFn: async (input: { lines: Array<{ raw_material_id: string; quantity: number; purchase_date: string }> }) => {
      const { error } = await supabase.rpc('fn_add_raw_material_details', { p_lines: input.lines })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { setLines([makeLine()]); setFormError(''); await invalidateAll() },
    onError: (e) => setFormError(friendlyError(e)),
  })

  const editDetailMutation = useMutation({
    mutationFn: async (input: { detailId: string; newRmId: string; newQty: number; newDate: string }) => {
      const { error } = await supabase.rpc('fn_edit_raw_material_detail', {
        p_detail_id: input.detailId,
        p_new_raw_material_id: input.newRmId,
        p_new_quantity: input.newQty,
        p_new_purchase_date: input.newDate,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { closeEditDetail(); await invalidateAll() },
    onError: (e) => setEditDetailError(friendlyError(e)),
  })

  const deleteDetailMutation = useMutation({
    mutationFn: async (detailId: string) => {
      const { error } = await supabase.rpc('fn_delete_raw_material_detail', { p_detail_id: detailId })
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => { setDeleteDetailTarget(null); await invalidateAll() },
    onError: (e: Error) => alert(`Delete failed: ${friendlyError(e)}`),
  })

  // ── Manage Materials handlers ──────────────────────────────────────────────
  const resetRmForm = () => { setRmName(''); setRmUnit('Piece'); setRmType('Core'); setRmError(''); setEditingRmId(null) }
  const openManageMaterials = () => { resetRmForm(); setManageMaterialsOpen(true) }
  const closeManageMaterials = () => { resetRmForm(); setManageMaterialsOpen(false) }

  const startEditRm = (row: RawMaterial) => {
    setEditingRmId(row.id); setRmName(row.name); setRmUnit(row.measured_unit); setRmType(row.type); setRmError('')
  }

  const onSaveRawMaterial = () => {
    const trimmed = rmName.trim()
    if (!trimmed) { setRmError('Name is required.'); return }
    if (editingRmId) {
      updateRmMutation.mutate({ id: editingRmId, name: trimmed, measuredUnit: rmUnit, type: rmType })
    } else {
      createRmMutation.mutate({ name: trimmed, measuredUnit: rmUnit, type: rmType })
    }
  }

  // ── Buying form handlers ───────────────────────────────────────────────────
  const updateLine = (i: number, patch: Partial<BuyingLineState>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const onRawMaterialChange = (i: number, rmId: string) => {
    const m = materialsById.get(rmId)
    updateLine(i, { rawMaterialId: rmId, unit: m?.measured_unit ?? unitFallback })
  }

  const addLine = () => setLines((prev) => [...prev, makeLine()])
  const removeLine = (i: number) => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))

  const onSubmitBuying = () => {
    setFormError('')
    if (!hasRawMaterials) { setFormError('No raw materials. Add one via + Manage Materials.'); return }
    if (!purchaseDate) { setFormError('Purchase date is required.'); return }
    const parsed: Array<{ raw_material_id: string; quantity: number; purchase_date: string }> = []
    for (const line of lines) {
      if (!line.rawMaterialId) { setFormError('Please select a raw material for every line.'); return }
      const qty = Number(line.quantity)
      if (!Number.isFinite(qty) || qty <= 0) { setFormError('Each quantity must be > 0.'); return }
      parsed.push({ raw_material_id: line.rawMaterialId, quantity: qty, purchase_date: purchaseDate })
    }
    addDetailMutation.mutate({ lines: parsed })
  }

  // ── Edit detail handlers ───────────────────────────────────────────────────
  const openEditDetail = (row: DetailRow) => {
    setEditingDetail(row)
    setEditDetailRmId(row.raw_material_id)
    setEditDetailQty(String(row.quantity))
    setEditDetailDate(row.purchase_date)
    setEditDetailError('')
  }

  const closeEditDetail = () => {
    setEditingDetail(null); setEditDetailRmId(''); setEditDetailQty(''); setEditDetailDate(''); setEditDetailError('')
  }

  const onEditDetailSubmit = () => {
    setEditDetailError('')
    if (!editDetailRmId) { setEditDetailError('Please select a raw material.'); return }
    const num = Number(editDetailQty)
    if (!Number.isFinite(num) || num <= 0) { setEditDetailError('Quantity must be > 0.'); return }
    if (!editDetailDate) { setEditDetailError('Date is required.'); return }
    if (editingDetail) {
      editDetailMutation.mutate({ detailId: editingDetail.id, newRmId: editDetailRmId, newQty: num, newDate: editDetailDate })
    }
  }

  const isSavingRm = createRmMutation.isPending || updateRmMutation.isPending

  return (
    <ModuleShell title="Raw Material" description="Manage raw materials and record purchases." tableName="Raw Material">
      {/* Delete Raw Material Confirm */}
      <ConfirmModal
        open={Boolean(deleteRmTarget)}
        title="Delete Raw Material"
        description={deleteRmTarget ? `Delete "${deleteRmTarget.name}"? This will also delete all its detail entries.` : ''}
        confirmLabel="Delete" confirmVariant="destructive" busy={deleteRmMutation.isPending}
        onCancel={() => setDeleteRmTarget(null)}
        onConfirm={() => { if (deleteRmTarget) deleteRmMutation.mutate(deleteRmTarget.id) }}
      />

      {/* Delete Detail Confirm */}
      <ConfirmModal
        open={Boolean(deleteDetailTarget)}
        title="Delete Raw Material Detail"
        description={deleteDetailTarget ? `Delete entry for "${deleteDetailTarget.raw_materials?.name}" (${Number(deleteDetailTarget.quantity).toLocaleString()} ${deleteDetailTarget.unit})? Stock will be reversed.` : ''}
        confirmLabel="Delete" confirmVariant="destructive" busy={deleteDetailMutation.isPending}
        onCancel={() => setDeleteDetailTarget(null)}
        onConfirm={() => { if (deleteDetailTarget) deleteDetailMutation.mutate(deleteDetailTarget.id) }}
      />

      {/* Edit Detail Modal */}
      <ConfirmModal
        open={Boolean(editingDetail)} onCancel={closeEditDetail} onConfirm={onEditDetailSubmit}
        title="Edit Raw Material Detail"
        description="Update raw material, quantity, or date. Stock adjusts automatically."
        confirmLabel="Save Changes" busy={editDetailMutation.isPending}
      >
        <div className="mb-2 mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="dark:text-slate-300">Raw Material</Label>
            <Combobox options={comboboxOptions} value={editDetailRmId} onValueChange={setEditDetailRmId} placeholder="Select raw material..." className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Quantity</Label>
              <Input type="number" min="0.001" step="any" value={editDetailQty} onChange={(e) => setEditDetailQty(e.target.value)} className="dark:bg-slate-800 dark:text-slate-200" />
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-300">Date</Label>
              <Input type="date" value={editDetailDate} onChange={(e) => setEditDetailDate(e.target.value)} className="dark:bg-slate-800 dark:text-slate-200" />
            </div>
          </div>
          {editDetailError && <p className="text-sm text-rose-600">{editDetailError}</p>}
        </div>
      </ConfirmModal>

      {/* Manage Materials Modal */}
      {manageMaterialsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-2xl max-h-[85vh] overflow-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Manage Raw Materials</h3>
              <Button type="button" variant="outline" size="sm" onClick={closeManageMaterials}>✕</Button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {editingRmId ? 'Edit Material' : 'Add New Material'}
              </h4>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="modal-rm-name">Name</Label>
                  <Input id="modal-rm-name" placeholder="Material name" value={rmName} onChange={(e) => setRmName(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={rmType} onValueChange={(v) => setRmType(v as MaterialType)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{materialTypes.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Measured Unit</Label>
                  <Select value={rmUnit} onValueChange={(v) => setRmUnit(v as Unit)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{measuredUnits.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button type="button" onClick={onSaveRawMaterial} disabled={isSavingRm}>
                  {isSavingRm ? 'Saving...' : editingRmId ? 'Update Material' : 'Add Material'}
                </Button>
                {editingRmId && <Button type="button" variant="outline" onClick={resetRmForm}>Cancel Edit</Button>}
                {rmError ? <p className="text-sm text-rose-600">{rmError}</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Measured Unit</TableHead>
                    <TableHead className="w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRm.length ? paginatedRm.map((row) => (
                    <TableRow key={row.id} className={editingRmId === row.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{row.measured_unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => startEditRm(row)} className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setManageMaterialsOpen(false); setDeleteRmTarget(row) }} disabled={deleteRmMutation.isPending} className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell className="text-slate-500 dark:text-slate-400" colSpan={4}>No raw materials yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {totalRm > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <Pagination currentPage={rmPage} totalItems={totalRm} pageSize={rmPageSize} onPageChange={setRmPage} onPageSizeChange={setRmPageSize} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Add Raw Material Detail */}
        <CollapsibleSection title="Add Raw Material Detail">
          <div className="flex justify-end mb-3">
            <Button type="button" onClick={openManageMaterials} className="shrink-0">+ Manage Materials</Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-5 md:items-end dark:border-slate-700 dark:bg-slate-900/70">
                <div className="space-y-1">
                  <Label>Raw Material</Label>
                  <Combobox options={comboboxOptions} value={line.rawMaterialId} onValueChange={(v) => onRawMaterialChange(index, v)} placeholder="Type or select..." className="w-full" />
                </div>
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input type="number" min="0" step="0.001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label>Unit</Label>
                  <Input value={line.unit} disabled />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="h-9 w-9 p-0" onClick={() => removeLine(index)}>-</Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={addLine}>+ Add More</Button>
            <Button className="w-full sm:w-auto" type="button" onClick={onSubmitBuying} disabled={addDetailMutation.isPending || rmQuery.isLoading || !hasRawMaterials}>
              {addDetailMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
        </CollapsibleSection>

        {/* Raw Material Detail Table */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Raw Material Detail</h3>

          {detailQuery.isLoading && <p className="text-sm text-slate-600 dark:text-slate-300">Loading...</p>}
          {detailQuery.isError && <p className="text-sm text-rose-600">Failed to load detail.</p>}

          {!detailQuery.isLoading && !detailQuery.isError && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raw Material</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDetail.length ? paginatedDetail.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.raw_materials?.name ?? '—'}</TableCell>
                      <TableCell>{Number(row.quantity).toLocaleString()}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{new Date(row.purchase_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDetail(row)} className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10" title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteDetailTarget(row)} disabled={deleteDetailMutation.isPending} className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell className="text-slate-500 dark:text-slate-400" colSpan={5}>No entries yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {totalDetail > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <Pagination currentPage={detailPage} totalItems={totalDetail} pageSize={detailPageSize} onPageChange={setDetailPage} onPageSizeChange={setDetailPageSize} />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </ModuleShell>
  )
}
