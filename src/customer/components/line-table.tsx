'use client'

import { Plus } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'

export type Row = Record<string, string>
/** `disabled` shows a column the customer can't fill (the rate, which staff send in their quote). */
export type Column = { key: string; label: string; placeholder?: string; numeric?: boolean; optional?: boolean; disabled?: boolean }

const hasValue = (value: string | undefined) => !!value?.trim()

/** A row is "started" once any box has text; started rows must have every required box filled. */
export const isRowStarted = (row: Row) => Object.values(row).some(hasValue)
export const isRowComplete = (row: Row | undefined, columns: Column[]) => !!row && columns.every(column => column.optional || column.disabled || hasValue(row[column.key]))

/**
 * Numbered rows (bazar list, medicines). A table starts with one row; "add more" appears only
 * once every required box in the last row is filled.
 */
export function LineTable({ columns, template, rows, onChange, addLabel }: { columns: Column[]; template: string; rows: Row[]; onChange: (rows: Row[]) => void; addLabel: string }) {
  const { rowNumber } = useLang()
  const update = (index: number, key: string, value: string) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  return (
    <div className="line-table" style={{ '--cols': template } as React.CSSProperties}>
      <div className="line-head" aria-hidden="true">
        <span />
        {columns.map(column => (
          <span key={column.key}>{column.label}</span>
        ))}
      </div>
      {/* Rows are only ever appended, so the index is a stable key. */}
      {rows.map((row, index) => (
        <div className="line-row" key={index}>
          <span className="line-no">{rowNumber(index)}</span>
          {columns.map(column => (
            <input
              key={column.key}
              aria-label={`${column.label} ${rowNumber(index)}`}
              type={column.numeric ? 'number' : 'text'}
              inputMode={column.numeric ? 'numeric' : undefined}
              min={column.numeric ? 0 : undefined}
              step={column.numeric ? 1 : undefined}
              placeholder={column.placeholder}
              disabled={column.disabled}
              tabIndex={column.disabled ? -1 : undefined}
              value={column.disabled ? '' : (row[column.key] ?? '')}
              onChange={e => update(index, column.key, e.target.value)}
            />
          ))}
        </div>
      ))}
      {isRowComplete(rows[rows.length - 1], columns) && (
        <button type="button" className="add-row" onClick={() => onChange([...rows, {}])}>
          <Plus size={15} />
          {addLabel}
        </button>
      )}
    </div>
  )
}
