import { type KeyboardEvent, useDeferredValue, useState } from 'react';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  LoaderCircle,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminApiError,
  fetchCoverLetterGenerationLog,
  regenerateCoverLetterGenerationLog,
} from '@/admin/api';
import { buildCoverLetterPreviewUrl } from '@/admin/preview-url';
import {
  formatCoverLetterGenerationMethodLabel,
  type CoverLetterGenerationLogSummary,
} from '@/admin/generation-logs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminLogsTableProps {
  errorMessage: string;
  generationLogs: CoverLetterGenerationLogSummary[];
  isLoading: boolean;
  onGenerationLogsChanged: () => void;
  onOpenPreview: (previewUrl: string) => void;
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function AdminLogsTable({
  errorMessage,
  generationLogs,
  isLoading,
  onGenerationLogsChanged,
  onOpenPreview,
}: AdminLogsTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [pendingPreviewLogId, setPendingPreviewLogId] = useState('');
  const [pendingRegenerateLogIds, setPendingRegenerateLogIds] = useState<
    string[]
  >([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [searchValue, setSearchValue] = useState('');
  const [sorting, setSorting] = useState([
    {
      desc: true,
      id: 'createdAt',
    },
  ]);
  const deferredSearchValue = useDeferredValue(searchValue);
  const columns: ColumnDef<CoverLetterGenerationLogSummary>[] = [
    {
      cell: function renderSelectCell({ row }) {
        return (
          <Checkbox
            aria-label={`Select ${row.original.filename}`}
            checked={row.getIsSelected()}
            onCheckedChange={function handleCheckedChange(checked) {
              row.toggleSelected(Boolean(checked));
            }}
            onClick={function handleCheckboxClick(event) {
              event.stopPropagation();
            }}
          />
        );
      },
      enableHiding: false,
      enableSorting: false,
      header: function renderSelectHeader({ table }) {
        return (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={function handleCheckedChange(checked) {
              table.toggleAllPageRowsSelected(Boolean(checked));
            }}
            onClick={function handleCheckboxClick(event) {
              event.stopPropagation();
            }}
          />
        );
      },
      id: 'select',
    },
    {
      accessorKey: 'bodyVersionName',
      cell: function renderBodyVersionCell({ row }) {
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.original.bodyVersionName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.filename}
            </span>
          </div>
        );
      },
      header: function renderBodyVersionHeader({ column }) {
        return (
          <DataTableColumnHeader column={column} title="Body template" />
        );
      },
    },
    {
      accessorKey: 'role',
      header: function renderRoleHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Role" />;
      },
    },
    {
      accessorKey: 'company',
      header: function renderCompanyHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Company" />;
      },
    },
    {
      accessorKey: 'hiringManager',
      header: function renderHiringManagerHeader({ column }) {
        return (
          <DataTableColumnHeader column={column} title="Hiring manager" />
        );
      },
      id: 'hiringManager',
    },
    {
      accessorKey: 'title',
      cell: function renderTitleCell({ row }) {
        return <span className="max-w-64 truncate">{row.original.title}</span>;
      },
      header: function renderTitleHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Title" />;
      },
    },
    {
      accessorKey: 'filename',
      cell: function renderFilenameCell({ row }) {
        return (
          <span className="max-w-72 truncate" title={row.original.filename}>
            {row.original.filename}
          </span>
        );
      },
      header: function renderFilenameHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Filename" />;
      },
    },
    {
      accessorFn: function getMethodLabel(row) {
        return formatCoverLetterGenerationMethodLabel(row.method);
      },
      header: function renderMethodHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Method" />;
      },
      id: 'method',
    },
    {
      accessorKey: 'createdAt',
      cell: function renderCreatedAtCell({ row }) {
        return (
          <span className="whitespace-nowrap">
            {timestampFormatter.format(new Date(row.original.createdAt))}
          </span>
        );
      },
      header: function renderCreatedAtHeader({ column }) {
        return <DataTableColumnHeader column={column} title="Created" />;
      },
    },
    {
      cell: function renderActionsCell({ row }) {
        const isPendingPreview = pendingPreviewLogId === row.original.id;
        const isPendingRegenerate = pendingRegenerateLogIds.includes(
          row.original.id,
        );

        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Preview ${row.original.filename}`}
              disabled={isPendingPreview || pendingRegenerateLogIds.length > 0}
              onClick={function handlePreviewClick(event) {
                event.stopPropagation();
                void handleOpenPreview(row.original.id);
              }}
            >
              {isPendingPreview ? <LoaderCircle className="animate-spin" /> : <Eye />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Re-generate ${row.original.filename}`}
              disabled={pendingPreviewLogId.length > 0 || isPendingRegenerate}
              onClick={function handleRegenerateClick(event) {
                event.stopPropagation();
                void handleRegenerateLogs([row.original.id]);
              }}
            >
              {isPendingRegenerate ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Download />
              )}
            </Button>
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
      header: function renderActionsHeader() {
        return <span className="sr-only">Actions</span>;
      },
      id: 'actions',
    },
  ];
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: generationLogs,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: function globalFilterFn(row, _columnId, filterValue) {
      const normalizedFilterValue = String(filterValue).trim().toLowerCase();

      if (!normalizedFilterValue) {
        return true;
      }

      return [
        row.original.bodyVersionName,
        row.original.company,
        row.original.filename,
        row.original.hiringManager,
        formatCoverLetterGenerationMethodLabel(row.original.method),
        row.original.role,
        row.original.title,
      ].some(function someCellValue(cellValue) {
        return cellValue.toLowerCase().includes(normalizedFilterValue);
      });
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnVisibility,
      globalFilter: deferredSearchValue,
      rowSelection,
      sorting,
    },
  });
  const selectedLogCount = table.getFilteredSelectedRowModel().rows.length;
  const totalFilteredRowCount = table.getFilteredRowModel().rows.length;

  async function handleOpenPreview(logEntryId: string) {
    setPendingPreviewLogId(logEntryId);

    try {
      const generationLogEntry =
        await fetchCoverLetterGenerationLog(logEntryId);
      const previewUrl = buildCoverLetterPreviewUrl(
        generationLogEntry.adminDocument,
        generationLogEntry.request,
        {
          embedded: true,
        },
      );

      onOpenPreview(previewUrl);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingPreviewLogId('');
    }
  }

  async function handleRegenerateLogs(logEntryIds: string[]) {
    if (!logEntryIds.length) {
      return;
    }

    setPendingRegenerateLogIds(logEntryIds);

    try {
      for (const logEntryId of logEntryIds) {
        const pdf = await regenerateCoverLetterGenerationLog(logEntryId);

        downloadBlob(pdf.blob, pdf.filename || 'cover-letter.pdf');
      }

      setRowSelection({});
      onGenerationLogsChanged();
      toast(
        logEntryIds.length === 1
          ? 'Generated cover letter PDF.'
          : `Generated ${logEntryIds.length} cover letter PDFs.`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingRegenerateLogIds([]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Search generation logs"
            className="sm:max-w-sm"
            placeholder="Search logs..."
            value={searchValue}
            onChange={function handleSearchValueChange(event) {
              setSearchValue(event.target.value);
            }}
          />
          {selectedLogCount ? (
            <Button
              variant="outline"
              disabled={pendingRegenerateLogIds.length > 0}
              onClick={function handleBulkRegenerateClick() {
                const selectedLogIds = table
                  .getFilteredSelectedRowModel()
                  .rows.map(function mapSelectedRow(row) {
                    return row.original.id;
                  });

                void handleRegenerateLogs(selectedLogIds);
              }}
            >
              {pendingRegenerateLogIds.length > 0 ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Download data-icon="inline-start" />
              )}
              Re-generate/download {selectedLogCount} selected
            </Button>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Settings2 data-icon="inline-start" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter(function filterColumn(column) {
                return column.getCanHide();
              })
              .map(function renderColumnToggle(column) {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={function handleCheckedChange(checked) {
                      column.toggleVisibility(Boolean(checked));
                    }}
                  >
                    {getColumnLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(function renderHeaderGroup(
              headerGroup,
            ) {
              return (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(function renderHeader(header) {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading generation logs...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(function renderRow(row) {
                return (
                  <TableRow
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    data-state={row.getIsSelected() && 'selected'}
                    className="cursor-pointer"
                    onClick={function handleRowClick() {
                      void handleOpenPreview(row.original.id);
                    }}
                    onKeyDown={function handleRowKeyDown(
                      event: KeyboardEvent<HTMLTableRowElement>,
                    ) {
                      if (
                        event.target !== event.currentTarget
                        || (event.key !== 'Enter' && event.key !== ' ')
                      ) {
                        return;
                      }

                      event.preventDefault();
                      void handleOpenPreview(row.original.id);
                    }}
                  >
                    {row.getVisibleCells().map(function renderCell(cell) {
                      return (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No generation logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedLogCount} of {totalFilteredRowCount} row(s) selected.
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={function handlePageSizeChange(value) {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map(function renderPageSize(pageSize) {
                    return (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {Math.max(table.getPageCount(), 1)}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to first page"
              disabled={!table.getCanPreviousPage()}
              onClick={function handleFirstPageClick() {
                table.firstPage();
              }}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={function handlePreviousPageClick() {
                table.previousPage();
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to next page"
              disabled={!table.getCanNextPage()}
              onClick={function handleNextPageClick() {
                table.nextPage();
              }}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Go to last page"
              disabled={!table.getCanNextPage()}
              onClick={function handleLastPageClick() {
                table.lastPage();
              }}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTableColumnHeader({
  column,
  title,
}: {
  column: {
    getCanSort: () => boolean;
    getIsSorted: () => false | 'asc' | 'desc';
    toggleSorting: (desc?: boolean) => void;
  };
  title: string;
}) {
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  return (
    <Button
      variant="ghost"
      className="-ml-2 h-8"
      onClick={function handleSortClick() {
        column.toggleSorting(column.getIsSorted() === 'asc');
      }}
    >
      {title}
      <ArrowUpDown data-icon="inline-end" />
    </Button>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(function revokeObjectUrl() {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function getColumnLabel(columnId: string) {
  switch (columnId) {
    case 'bodyVersionName':
      return 'Body template';
    case 'createdAt':
      return 'Created';
    case 'filename':
      return 'Filename';
    case 'hiringManager':
      return 'Hiring manager';
    case 'method':
      return 'Method';
    case 'role':
      return 'Role';
    case 'title':
      return 'Title';
    default:
      return 'Company';
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}
