"use client"

/**
 * Data-table toolkit — adapted from the shadcnblocks Pro block "data-table13"
 * (Tabbed Filter Data Table, TanStack Table v8). Kept: useDataTable hook,
 * sortable column header, tabbed status filter with counts, pagination.
 * Changed: type-only imports, church copy, compact density for 1440×900.
 */
import * as React from "react"
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type Table as TableType,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type UseDataTableOptions<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  getRowId?: (row: TData) => string
  initialSorting?: SortingState
  initialGlobalFilter?: string
  initialFilters?: ColumnFiltersState
  initialVisibility?: VisibilityState
  initialSelection?: RowSelectionState
  pageSize?: number
}

export function useDataTable<TData>(options: UseDataTableOptions<TData>) {
  const {
    data,
    columns,
    getRowId,
    initialSorting = [],
    initialFilters = [],
    initialGlobalFilter = "",
    initialVisibility = {},
    initialSelection = {},
    pageSize = 10,
  } = options

  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialFilters)
  const [globalFilter, setGlobalFilter] = React.useState<string>(initialGlobalFilter)
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialVisibility)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(initialSelection)

  // TanStack Table returns a mutable table object, so the React Compiler skips memoizing this hook. That is expected.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return { table, setColumnFilters, setGlobalFilter, globalFilter }
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>
  title: string
  className?: string
}) {
  const t = useTranslations("table")
  if (!column.getCanSort()) {
    return <span className={cn("flex h-8 items-center", className)}>{title}</span>
  }
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className={cn(
        "-mx-1 inline-flex h-8 items-center gap-1.5 px-1 uppercase hover:text-foreground",
        className
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
      aria-label={t("sortBy", { column: title })}
    >
      {title}
      {sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" />
      )}
    </button>
  )
}

export function DataTablePagination<TData>({
  table,
  summary,
  totalOverride,
}: {
  table: TableType<TData>
  /** "Showing 1–50 of 120 people"; defaults to the range without a noun. */
  summary?: (range: { start: number; end: number; total: number }) => string
  totalOverride?: number
}) {
  const t = useTranslations("table")
  const { pageIndex, pageSize } = table.getState().pagination
  const filtered = table.getFilteredRowModel().rows.length
  const total = totalOverride ?? filtered
  const start = filtered === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, filtered)
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex items-center justify-between gap-4 pt-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {filtered === 0
          ? t("noResults")
          : (summary?.({ start, end, total }) ?? t("showing", { start, end, total }))}
      </span>
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{t("page", { page: pageIndex + 1, count: pageCount })}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label={t("previous")}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={pageIndex + 1 >= pageCount}
            aria-label={t("next")}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DataTableView<TData>({
  table,
  className,
  rowClassName,
  emptyMessage,
}: {
  table: TableType<TData>
  className?: string
  rowClassName?: (row: TData) => string | undefined
  emptyMessage?: React.ReactNode
}) {
  const t = useTranslations("table")
  const columnCount = table.getVisibleLeafColumns().length
  return (
    <div className={cn("overflow-hidden border", className)}>
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{
                    width:
                      header.column.columnDef.size !== 150
                        ? header.column.columnDef.size
                        : undefined,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={rowClassName?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                {emptyMessage ?? t("noResults")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
