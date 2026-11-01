import type { Prisma } from '../generated/prisma/client'

/** Rows fetched from the cursor at a time, and rows per INSERT statement. */
const BATCH = 500

/** "Order" → "Order", with any double quote doubled. */
export const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`

/** A string as an SQL literal (with standard_conforming_strings on, only quotes need doubling), or NULL. */
export const quoteLiteral = (value: string | null) => (value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`)

type Column = { table: string; column: string; type: string; notNull: boolean; default: string | null }
type Sequence = { name: string; type: string; start: string; increment: string; min: string; max: string; cache: string; cycle: boolean; last: string | null }
type Constraint = { table: string; name: string; type: string; def: string }

/**
 * The database as one plain SQL file, made by the app itself for servers without pg_dump. It holds what
 * this schema uses: enums, sequences, tables, every row, primary and unique keys, checks, indexes and
 * foreign keys, in pg_dump's order (data before keys and indexes, foreign keys last). Rows are INSERTs,
 * not COPY, so psql, pgAdmin's Query Tool or any client can run it into an empty database.
 *
 * It runs in one read-only REPEATABLE READ transaction, so every table is read at the same moment. With
 * search_path set to pg_catalog, PostgreSQL writes every name schema-qualified, as pg_dump does.
 */
export async function writeSqlDump(tx: Prisma.TransactionClient, schema: string, write: (text: string) => Promise<void>, meta: { database: string; serverVersion: string }) {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
  await tx.$executeRawUnsafe("SET LOCAL search_path = pg_catalog")
  // Text forms that read back the same whatever the restoring server's settings.
  await tx.$executeRawUnsafe("SET LOCAL datestyle = 'ISO, YMD'")
  await tx.$executeRawUnsafe("SET LOCAL intervalstyle = 'postgres'")
  await tx.$executeRawUnsafe("SET LOCAL timezone = 'UTC'")

  const enums = await tx.$queryRawUnsafe<{ name: string; labels: string[] }[]>(
    `SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
       FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = $1 GROUP BY t.typname ORDER BY t.typname`,
    schema,
  )
  const sequences = await tx.$queryRawUnsafe<Sequence[]>(
    `SELECT sequencename::text AS name, data_type::text AS type, start_value::text AS start, increment_by::text AS increment,
            min_value::text AS min, max_value::text AS max, cache_size::text AS cache, cycle, last_value::text AS last
       FROM pg_sequences WHERE schemaname = $1 ORDER BY sequencename`,
    schema,
  )
  const owners = await tx.$queryRawUnsafe<{ sequence: string; table: string; column: string }[]>(
    `SELECT s.relname::text AS sequence, t.relname::text AS table, a.attname::text AS column
       FROM pg_depend d
       JOIN pg_class s ON s.oid = d.objid AND s.relkind = 'S'
       JOIN pg_namespace n ON n.oid = s.relnamespace
       JOIN pg_class t ON t.oid = d.refobjid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass AND d.deptype = 'a' AND n.nspname = $1`,
    schema,
  )
  const columns = await tx.$queryRawUnsafe<Column[]>(
    `SELECT c.relname::text AS table, a.attname::text AS column, format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS "notNull", pg_get_expr(d.adbin, d.adrelid) AS default
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE n.nspname = $1 AND c.relkind IN ('r', 'p')
      ORDER BY c.relname, a.attnum`,
    schema,
  )
  const constraints = await tx.$queryRawUnsafe<Constraint[]>(
    `SELECT c.relname::text AS table, con.conname::text AS name, con.contype::text AS type, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND con.contype IN ('p', 'u', 'c', 'x', 'f')
      ORDER BY c.relname, con.conname`,
    schema,
  )
  // Indexes of their own; the ones behind a primary key, unique or exclusion constraint come with it.
  const indexes = await tx.$queryRawUnsafe<{ def: string }[]>(
    `SELECT pg_get_indexdef(i.indexrelid) AS def
       FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1
        AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conrelid = i.indrelid AND con.conindid = i.indexrelid AND con.contype IN ('p', 'u', 'x'))
      ORDER BY 1`,
    schema,
  )

  const name = (relation: string) => `${quoteIdent(schema)}.${quoteIdent(relation)}`
  const tables = new Map<string, Column[]>()
  for (const column of columns) tables.set(column.table, [...(tables.get(column.table) ?? []), column])

  await write(
    [
      `-- Kingfisher database backup of "${meta.database}", made by the app on ${new Date().toISOString()} (PostgreSQL ${meta.serverVersion}).`,
      '-- Restore it into a new, empty UTF8 database:',
      '--   createdb -E UTF8 -T template0 <new database>',
      '--   psql -v ON_ERROR_STOP=1 -d <new database> -f <this file>',
      "-- (or open it in pgAdmin's Query Tool and run it), then point DATABASE_URL at the new database.",
      '',
      "SET client_encoding = 'UTF8';",
      'SET standard_conforming_strings = on;',
      "SET datestyle = 'ISO, YMD';",
      "SET intervalstyle = 'postgres';",
      "SET timezone = 'UTC';",
      'SET check_function_bodies = false;',
      'BEGIN;',
      '',
      ...(schema === 'public' ? [] : [`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)};`, '']),
      ...enums.map(type => `CREATE TYPE ${name(type.name)} AS ENUM (${type.labels.map(quoteLiteral).join(', ')});`),
      '',
      ...sequences.map(
        sequence =>
          `CREATE SEQUENCE ${name(sequence.name)} AS ${sequence.type} START WITH ${sequence.start} INCREMENT BY ${sequence.increment} ` +
          `MINVALUE ${sequence.min} MAXVALUE ${sequence.max} CACHE ${sequence.cache}${sequence.cycle ? ' CYCLE' : ''};`,
      ),
      '',
      ...[...tables].map(([table, cols]) => {
        const lines = cols.map(col => `  ${quoteIdent(col.column)} ${col.type}${col.default === null ? '' : ` DEFAULT ${col.default}`}${col.notNull ? ' NOT NULL' : ''}`)
        return `CREATE TABLE ${name(table)} (\n${lines.join(',\n')}\n);\n`
      }),
      ...owners.map(owner => `ALTER SEQUENCE ${name(owner.sequence)} OWNED BY ${name(owner.table)}.${quoteIdent(owner.column)};`),
      '',
    ].join('\n') + '\n',
  )

  for (const [table, cols] of tables) {
    const select = cols.map((col, index) => `${quoteIdent(col.column)}::text AS c${index}`).join(', ')
    const insert = `INSERT INTO ${name(table)} (${cols.map(col => quoteIdent(col.column)).join(', ')}) VALUES\n`
    await write(`-- Data: ${table}\n`)
    await tx.$executeRawUnsafe(`DECLARE dump_rows NO SCROLL CURSOR FOR SELECT ${select} FROM ${name(table)}`)
    for (;;) {
      const rows = await tx.$queryRawUnsafe<Record<string, string | null>[]>(`FETCH ${BATCH} FROM dump_rows`)
      if (rows.length === 0) break
      const values = rows.map(row => `(${cols.map((_, index) => quoteLiteral(row[`c${index}`] ?? null)).join(', ')})`)
      await write(`${insert}${values.join(',\n')};\n`)
      if (rows.length < BATCH) break
    }
    await tx.$executeRawUnsafe('CLOSE dump_rows')
    await write('\n')
  }

  const keys = constraints.filter(con => con.type !== 'f')
  const foreignKeys = constraints.filter(con => con.type === 'f')
  await write(
    [
      ...sequences.map(sequence =>
        sequence.last === null
          ? `SELECT pg_catalog.setval('${name(sequence.name).replaceAll("'", "''")}', ${sequence.start}, false);`
          : `SELECT pg_catalog.setval('${name(sequence.name).replaceAll("'", "''")}', ${sequence.last}, true);`,
      ),
      '',
      ...keys.map(con => `ALTER TABLE ONLY ${name(con.table)} ADD CONSTRAINT ${quoteIdent(con.name)} ${con.def};`),
      '',
      ...indexes.map(index => `${index.def};`),
      '',
      ...foreignKeys.map(con => `ALTER TABLE ONLY ${name(con.table)} ADD CONSTRAINT ${quoteIdent(con.name)} ${con.def};`),
      '',
      'COMMIT;',
      '',
    ].join('\n'),
  )
}
