import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({ 
  currentPage, 
  totalItems, 
  pageSize, 
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 15, 20, 50, 100]
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
        </p>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline">|</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Per page:</span>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(value) => {
                onPageSizeChange(Number(value))
                onPageChange(1) // Reset to page 1 on page size change
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
