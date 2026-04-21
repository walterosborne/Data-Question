import { createRequire } from 'node:module'

import type { LicenseRecord } from '../src/types'
import { sqlServerConfig } from './sqlServerConfig'

const require = createRequire(import.meta.url)

const SAFE_TABLE_NAME_PATTERN = /^[A-Za-z0-9_.[\]]+$/

let poolPromise: Promise<import('mssql').ConnectionPool> | null = null

type LicenseHistoryRow = {
  UsageDate: string | Date
  network: string | null
  vendorname: string | null
  featurename: string | null
  licensetotal: number | null
  numbernormal: number | null
  numberdenials: number | null
}

function getSqlClient(): typeof import('mssql/msnodesqlv8') {
  try {
    return require('mssql/msnodesqlv8') as typeof import('mssql/msnodesqlv8')
  } catch (error) {
    throw new Error(
      `The msnodesqlv8 driver is not available. Install the optional dependency in the Windows/ODBC environment that will run this backend. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

function getMissingConfigFields(): string[] {
  const missing: string[] = []

  if (!sqlServerConfig.server.trim()) {
    missing.push('server')
  }

  if (!sqlServerConfig.database.trim()) {
    missing.push('database')
  }

  if (!sqlServerConfig.tableOrView.trim()) {
    missing.push('tableOrView')
  }

  return missing
}

function getValidatedTableOrView(): string {
  const tableOrView = sqlServerConfig.tableOrView.trim()

  if (!SAFE_TABLE_NAME_PATTERN.test(tableOrView)) {
    throw new Error(
      'sqlServerConfig.tableOrView may only contain letters, numbers, underscores, dots, and square brackets.',
    )
  }

  return tableOrView
}

function getConnectionConfig(): import('mssql').config {
  const missingFields = getMissingConfigFields()

  if (missingFields.length > 0) {
    throw new Error(
      `Fill in ${missingFields.join(', ')} in server/sqlServerConfig.ts before starting the backend.`,
    )
  }

  const serverTarget = sqlServerConfig.instanceName.trim()
    ? `${sqlServerConfig.server}\\${sqlServerConfig.instanceName}`
    : sqlServerConfig.server

  return {
    server: sqlServerConfig.server,
    database: sqlServerConfig.database,
    connectionString: `Driver={${sqlServerConfig.driver}};Server=${serverTarget};Database=${sqlServerConfig.database};Trusted_Connection=Yes;`,
    options: {
      trustedConnection: true,
      instanceName: sqlServerConfig.instanceName || undefined,
      useUTC: true,
    },
  }
}

async function getPool(): Promise<import('mssql').ConnectionPool> {
  const connectionConfig = getConnectionConfig()

  if (!poolPromise) {
    poolPromise = getSqlClient().connect(connectionConfig)
  }

  return poolPromise
}

function normalizeUsageDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

export async function getLicenseHistory(): Promise<LicenseRecord[]> {
  const pool = await getPool()
  const tableOrView = getValidatedTableOrView()
  const result = await pool.request().query<LicenseHistoryRow>(`
    SELECT
      UsageDate,
      network,
      vendorname,
      featurename,
      licensetotal,
      numbernormal,
      numberdenials
    FROM ${tableOrView}
    ORDER BY UsageDate ASC, network ASC, vendorname ASC, featurename ASC
  `)

  return result.recordset.map((row) => ({
    UsageDate: normalizeUsageDate(row.UsageDate),
    network: String(row.network ?? ''),
    vendorname: String(row.vendorname ?? ''),
    featurename: String(row.featurename ?? ''),
    licensetotal: Number(row.licensetotal ?? 0),
    numbernormal: Number(row.numbernormal ?? 0),
    numberdenials: Number(row.numberdenials ?? 0),
  }))
}
