import { createRequire } from 'node:module'

import type { SqlClient } from 'msnodesqlv8'

import type { LicenseRecord } from '../src/types'
import { sqlServerConfig } from './sqlServerConfig'

const require = createRequire(import.meta.url)

const SAFE_TABLE_NAME_PATTERN = /^[A-Za-z0-9_.[\]]+$/

type LicenseHistoryRow = {
  UsageDate: string | Date
  network: string | null
  vendorname: string | null
  featurename: string | null
  licensetotal: number | null
  numbernormal: number | null
  numberdenials: number | null
}

const sql: SqlClient = require('msnodesqlv8') as SqlClient

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

function getConnectionString(): string {
  const missingFields = getMissingConfigFields()

  if (missingFields.length > 0) {
    throw new Error(
      `Fill in ${missingFields.join(', ')} in server/sqlServerConfig.ts before starting the backend.`,
    )
  }

  if (sqlServerConfig.connectionString.trim()) {
    return sqlServerConfig.connectionString.trim()
  }

  return [
    `Driver={${sqlServerConfig.driver}}`,
    `Server=${sqlServerConfig.server}`,
    `Database=${sqlServerConfig.database}`,
    'Trusted_Connection=Yes',
    `Connect Timeout=${sqlServerConfig.connectTimeoutSeconds}`,
    `Encrypt=${sqlServerConfig.encrypt ? 'True' : 'False'}`,
    `TrustServerCertificate=${sqlServerConfig.trustServerCertificate ? 'True' : 'False'}`,
    `ApplicationIntent=${sqlServerConfig.applicationIntent}`,
    `MultiSubnetFailover=${sqlServerConfig.multiSubnetFailover ? 'True' : 'False'}`,
  ].join(';')
}

function normalizeUsageDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

export async function getLicenseHistory(): Promise<LicenseRecord[]> {
  const tableOrView = getValidatedTableOrView()
  const queryText = `
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
  `

  const rows = await new Promise<LicenseHistoryRow[]>((resolve, reject) => {
    sql.query<LicenseHistoryRow>(
      getConnectionString(),
      queryText,
      (error, resultRows) => {
        if (error) {
          reject(error)
          return
        }

        resolve(resultRows)
      },
    )
  })

  return rows.map((row) => ({
    UsageDate: normalizeUsageDate(row.UsageDate),
    network: String(row.network ?? ''),
    vendorname: String(row.vendorname ?? ''),
    featurename: String(row.featurename ?? ''),
    licensetotal: Number(row.licensetotal ?? 0),
    numbernormal: Number(row.numbernormal ?? 0),
    numberdenials: Number(row.numberdenials ?? 0),
  }))
}
