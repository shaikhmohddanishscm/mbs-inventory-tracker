import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ModuleShell } from '@/components/app/module-shell'
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
import type { MaterialType, Unit } from '@/types/domain'

interface RawMaterialRow {
  id: string
  name: string
  measured_unit: Unit
  type: MaterialType
  current_qty: number
  date_added: string
}

const queryKey = ['raw-materials']

const measuredUnits: Unit[] = ['Piece', 'Bottle']
const materialTypes: MaterialType[] = ['Core', 'Packaging']

async function fetchRawMaterials(): Promise<RawMaterialRow[]> {
  const { data, error } = await supabase
    .from('raw_materials')
    .select('id,name,measured_unit,type,current_qty,date_added')
    .order('date_added', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data as RawMaterialRow[]) ?? []
}

interface CreateRawMaterialInput {
  name: string
  measuredUnit: Unit
  type: MaterialType
}

interface UpdateRawMaterialInput extends CreateRawMaterialInput {
  id: string
}

async function createRawMaterial(input: CreateRawMaterialInput): Promise<void> {
  const { error } = await supabase.from('raw_materials').insert({
    name: input.name,
    measured_unit: input.measuredUnit,
    type: input.type,
    current_qty: 0,
  })

  if (error) {
    throw new Error(error.message)
  }
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

  if (error) {
    throw new Error(error.message)
  }
}

async function deleteRawMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('raw_materials').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

function buildMaterialCode(name: string, index: number) {
  const fromPattern = name.match(/MBS\d{3}/i)?.[0]
  if (fromPattern) return fromPattern.toUpperCase()
  return `RM-${String(index + 1).padStart(3, '0')}`
}

export function RawMaterialsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('Piece')
  const [type, setType] = useState<MaterialType>('Core')
  const [searchText, setSearchText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RawMaterialRow | null>(null)
  const [formError, setFormError] = useState<string>('')

  const rawMaterialsQuery = useQuery({
    queryKey,
    queryFn: fetchRawMaterials,
  })

  const createMutation = useMutation({
    mutationFn: createRawMaterial,
    onSuccess: async () => {
      resetForm()
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateRawMaterial,
    onSuccess: async () => {
      resetForm()
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRawMaterial,
    onSuccess: async () => {
      if (editingId) {
        resetForm()
      }
      setFormError('')
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  const resetForm = () => {
    setName('')
    setUnit('Piece')
    setType('Core')
    setEditingId(null)
    setFormError('')
  }

  const onSubmit = () => {
    const trimmed = name.trim()

    if (!trimmed) {
      setFormError('Name is required.')
      return
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: trimmed,
        measuredUnit: unit,
        type,
      })
      return
    }

    createMutation.mutate({
      name: trimmed,
      measuredUnit: unit,
      type,
    })
  }

  const startEdit = (row: RawMaterialRow) => {
    setEditingId(row.id)
    setName(row.name)
    setUnit(row.measured_unit)
    setType(row.type)
    setFormError('')
    setModalOpen(true)
  }

  const onDelete = (row: RawMaterialRow) => {
    setDeleteTarget(row)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  const openAddModal = () => {
    resetForm()
    setModalOpen(true)
  }

  const filteredMaterials = (rawMaterialsQuery.data ?? []).filter((row) => {
    const q = searchText.trim().toLowerCase()
    if (!q) return true

    const code = buildMaterialCode(row.name, 0).toLowerCase()
    const text = `${code} ${row.name} ${row.type} ${row.measured_unit}`.toLowerCase()
    return text.includes(q)
  })

  const { paginatedItems, currentPage, pageSize, setPageSize, totalItems, setCurrentPage } = usePagination(filteredMaterials, 10)

  return (
    <ModuleShell
      title="Raw Material"
      description="Manage material name, measured unit, and type."
      tableName="Raw Material"
    >
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
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingId ? 'Edit Raw Material' : 'Add Raw Material'}
            </h3>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="modal-raw-name">Name</Label>
                <Input
                  id="modal-raw-name"
                  placeholder="Material name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Measured Unit</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {measuredUnits.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as MaterialType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {materialTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  className="flex-1"
                  type="button"
                  onClick={onSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingId
                      ? 'Update'
                      : 'Save'}
                </Button>
                <Button
                  className="flex-1"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setModalOpen(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Raw Material Availability</h3>
            <div className="flex items-center gap-3">
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search raw materials..."
                className="w-full sm:w-[280px]"
              />
              <Button type="button" onClick={openAddModal} className="shrink-0">
                + Add
              </Button>
            </div>
          </div>

          {rawMaterialsQuery.isLoading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading materials...</p> : null}

          {rawMaterialsQuery.isError ? (
            <p className="text-sm text-rose-600">Failed to load data. Check Supabase config and table migration.</p>
          ) : null}

          {!rawMaterialsQuery.isLoading && !rawMaterialsQuery.isError ? (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty Available</TableHead>
                  <TableHead>Measured Unit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length ? (
                  paginatedItems.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>{buildMaterialCode(row.name, (currentPage - 1) * pageSize + index)}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell>{Number(row.current_qty).toLocaleString()}</TableCell>
                      <TableCell>{row.measured_unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => onDelete(row)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-slate-500 dark:text-slate-400" colSpan={6}>
                      No raw materials found.
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
