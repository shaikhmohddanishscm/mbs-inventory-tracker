import { useEffect, useMemo, useState } from 'react'

export function usePagination<T>(items: T[], initialPageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Reset to page 1 if current page exceeds total pages (e.g., when filtering or changing page size)
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [items.length, pageSize, currentPage])

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    pageSize,
    setPageSize,
    totalItems: items.length,
  }
}
