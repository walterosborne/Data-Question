import * as sql from 'mssql'

import type { LicenseRecord } from '../src/types'
import { sqlServerConfig } from './sqlServerConfig'

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

function getMissingConfigFields(): string[] {
  const missing: string[] = []

  if (!sqlServerConfig.connectionString.trim() && !sqlServerConfig.server.trim()) {
    missing.push('server')
  }

  if (!sqlServerConfig.connectionString.trim() && !sqlServerConfig.database.trim()) {
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

  const instanceName = sqlServerConfig.instanceName.trim() || undefined
  const usesDomainLogin = Boolean(sqlServerConfig.domain.trim())

  return {
    user: usesDomainLogin ? undefined : sqlServerConfig.user || undefined,
    password: usesDomainLogin ? undefined : sqlServerConfig.password || undefined,
    domain: usesDomainLogin ? undefined : sqlServerConfig.domain || undefined,
    server: sqlServerConfig.server,
    database: sqlServerConfig.database,
    port: instanceName ? undefined : sqlServerConfig.port,
    authentication: usesDomainLogin
      ? {
          type: 'ntlm',
          options: {
            userName: sqlServerConfig.user,
            password: sqlServerConfig.password,
            domain: sqlServerConfig.domain,
          },
        }
      : undefined,
    options: {
      instanceName,
      useUTC: true,
      encrypt: sqlServerConfig.encrypt,
      trustServerCertificate: sqlServerConfig.trustServerCertificate,
    },
  }
}

async function getPool(): Promise<import('mssql').ConnectionPool> {
  const connectionConfig = sqlServerConfig.connectionString.trim()
    ? sqlServerConfig.connectionString.trim()
    : getConnectionConfig()

  if (!poolPromise) {
    poolPromise = sql.connect(connectionConfig)
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
