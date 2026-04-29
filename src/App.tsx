import { useEffect, useState, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import {
  buildCapRows,
  getCapClosestToTargetDenialChance,
  getEstimator,
  uniqueValues,
} from './lib/licenseEstimator'
import type { LicenseRecord } from './types'

const WORKBOOK_PATH = '/license-history.xlsx'
const EXPECTED_COLUMNS = [
  'UsageDate',
  'network',
  'vendorname',
  'featurename',
  'licensetotal',
  'peakusage',
  'numberdenials',
] as const

function formatPercent(value: number): string {
  const roundedValue = Math.round(value * 10) / 10

  if (roundedValue === 100 && value < 100) {
    return '~100.0%'
  }

  return `${roundedValue.toFixed(1)}%`
}

function formatExpectedDenials(value: number): string {
  const roundedValue = Math.round(value * 10) / 10
  return Number.isInteger(roundedValue)
    ? `${roundedValue}`
    : `${roundedValue.toFixed(1)}`
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function toNumberValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const cleanedValue = value.replace(/,/g, '').trim()
    return cleanedValue ? Number(cleanedValue) : 0
  }

  return 0
}

function normalizeUsageDate(value: unknown): string {
  if (typeof value === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(value)

    if (parsedDate) {
      const year = String(parsedDate.y).padStart(4, '0')
      const month = String(parsedDate.m).padStart(2, '0')
      const day = String(parsedDate.d).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return toStringValue(value)
}

function normalizeColumnName(value: unknown): string {
  return toStringValue(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseLicenseHistoryRow(row: Record<string, unknown>): LicenseRecord | null {
  const vendorname = toStringValue(row.vendorname)
  const featurename = toStringValue(row.featurename)

  if (!vendorname && !featurename) {
    return null
  }

  return {
    UsageDate: normalizeUsageDate(row.UsageDate),
    network: toStringValue(row.network),
    vendorname,
    featurename,
    licensetotal: toNumberValue(row.licensetotal),
    peakusage: toNumberValue(row.peakusage),
    numberdenials: toNumberValue(row.numberdenials),
  }
}

function buildRowObject(
  headers: string[],
  rowValues: unknown[],
): Record<string, unknown> {
  return headers.reduce<Record<string, unknown>>((rowObject, header, index) => {
    rowObject[header] = rowValues[index]
    return rowObject
  }, {})
}

async function loadLicenseHistoryFromWorkbook(): Promise<LicenseRecord[]> {
  const response = await fetch(WORKBOOK_PATH)

  if (!response.ok) {
    throw new Error(
      'Place your Excel file at public/license-history.xlsx, then restart or refresh the app.',
    )
  }

  const workbookData = await response.arrayBuffer()
  const workbook = XLSX.read(workbookData, {
    type: 'array',
    cellDates: true,
  })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('The workbook does not contain any sheets.')
  }

  const firstWorksheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstWorksheet, {
    header: 1,
    defval: '',
  })
  const headerRow = rawRows[0] ?? []
  const normalizedHeaders = headerRow.map(normalizeColumnName)
  const missingColumns = EXPECTED_COLUMNS.filter(
    (column) => !normalizedHeaders.includes(normalizeColumnName(column)),
  )
  const records = rawRows
    .slice(1)
    .map((rowValues) =>
      buildRowObject(normalizedHeaders, Array.isArray(rowValues) ? rowValues : []),
    )
    .map(parseLicenseHistoryRow)
    .filter((row): row is LicenseRecord => row !== null)

  if (missingColumns.length > 0) {
    throw new Error(
      `The workbook is missing expected columns: ${missingColumns.join(', ')}.`,
    )
  }

  return records
}

export default function App() {
  const [licenseHistory, setLicenseHistory] = useState<LicenseRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<string>('')
  const [selectedVendor, setSelectedVendor] = useState<string>('')
  const [selectedLicense, setSelectedLicense] = useState<string>('')
  const [customCap, setCustomCap] = useState<string>('')

  const networks = uniqueValues(licenseHistory, 'network')

  const vendorOptions = uniqueValues(
    licenseHistory.filter((record) => record.network === selectedNetwork),
    'vendorname',
  )

  const licenseOptions = uniqueValues(
    licenseHistory.filter(
      (record) =>
        record.network === selectedNetwork &&
        record.vendorname === selectedVendor,
    ),
    'featurename',
  )

  const matchingRecords = licenseHistory.filter(
    (record) =>
      record.network === selectedNetwork &&
      record.vendorname === selectedVendor &&
      record.featurename === selectedLicense,
  )

  const baselineCap = getCapClosestToTargetDenialChance(matchingRecords, 50)
  const estimator = getEstimator(matchingRecords)
  const capRows = buildCapRows(estimator, baselineCap)
  const customCapValue = Number(customCap)
  const customCapChance = Number.isInteger(customCapValue)
    ? estimator?.getDenialChance(customCapValue) ?? null
    : null
  const customCapExpectedDenials = Number.isInteger(customCapValue)
    ? estimator?.getExpectedDenials(customCapValue) ?? null
    : null

  useEffect(() => {
    let isActive = true

    async function loadLicenseHistory() {
      setIsLoading(true)
      setLoadError('')

      try {
        const records = await loadLicenseHistoryFromWorkbook()

        if (isActive) {
          setLicenseHistory(records)
        }
      } catch (error) {
        if (isActive) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load license history from the Excel file.',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadLicenseHistory()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!networks.length) {
      setSelectedNetwork('')
      return
    }

    if (!selectedNetwork || !networks.includes(selectedNetwork)) {
      setSelectedNetwork(networks[0])
      setSelectedVendor('')
      setSelectedLicense('')
      setCustomCap('')
    }
  }, [networks, selectedNetwork])

  function resetSelections(nextNetwork: string) {
    setSelectedNetwork(nextNetwork)
    setSelectedVendor('')
    setSelectedLicense('')
    setCustomCap('')
  }

  function handleNetworkChange(event: ChangeEvent<HTMLSelectElement>) {
    resetSelections(event.target.value)
  }

  function handleVendorChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedVendor(event.target.value)
    setSelectedLicense('')
    setCustomCap('')
  }

  function handleLicenseChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedLicense(event.target.value)
    setCustomCap('')
  }

  function handleCustomCapChange(event: ChangeEvent<HTMLInputElement>) {
    setCustomCap(event.target.value)
  }

  return (
    <main className="app-shell">
      <div className="page-layout">
        <aside className="filter-card">
          <div className="filters">
            <label>
              <span>Network</span>
              <select
                value={selectedNetwork}
                onChange={handleNetworkChange}
                disabled={isLoading || !networks.length}
              >
                {selectedNetwork === '' ? (
                  <option value="">Select network</option>
                ) : null}
                {networks.map((network) => (
                  <option key={network} value={network}>
                    {network}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Vendor</span>
              <select
                value={selectedVendor}
                onChange={handleVendorChange}
                disabled={isLoading || !vendorOptions.length}
              >
                <option value="">Select vendor</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>License</span>
              <select
                value={selectedLicense}
                onChange={handleLicenseChange}
                disabled={isLoading || !licenseOptions.length}
              >
                <option value="">Select license</option>
                {licenseOptions.map((license) => (
                  <option key={license} value={license}>
                    {license}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <section className="card">
          <div className="workspace">
            <div className="logic-blurb">
              <h2>How this estimate works</h2>
              <p>
                The percentage is the chance that peak usage would go over the
                selected cap, and expected denials is the average amount above that
                cap.
              </p>
            </div>

            <div className="results-panel">
              {isLoading ? (
                <div className="empty-state">Loading license history...</div>
              ) : loadError ? (
                <div className="empty-state">{loadError}</div>
              ) : matchingRecords.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Possible License Cap</th>
                        <th>Chance of Any Denial</th>
                        <th>Expected Denials</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capRows.map((row) => (
                        <tr
                          key={row.cap}
                          className={row.cap === baselineCap ? 'active-row' : ''}
                        >
                          <td>{row.cap}</td>
                          <td>{formatPercent(row.denialChance)}</td>
                          <td>{formatExpectedDenials(row.expectedDenials)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  Select a vendor and license to load the historical records.
                </div>
              )}
            </div>
          </div>

          {matchingRecords.length > 0 ? (
            <div className="custom-cap-card">
              <div>
                <h2>Check a custom cap</h2>
                <p>
                  Enter any license cap to see the estimated chance of denials for
                  that number.
                </p>
              </div>

              <label className="custom-cap-input">
                <span>Custom cap</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customCap}
                  onChange={handleCustomCapChange}
                  placeholder="Enter a cap"
                />
              </label>

              <div className="custom-cap-result">
                {customCap === '' ? (
                  <p>Enter a number to calculate the estimate.</p>
                ) : customCapChance === null || customCapExpectedDenials === null ? (
                  <p>Please enter a whole number greater than 0.</p>
                ) : (
                  <p>
                    At a cap of <strong>{customCapValue}</strong>, the estimated
                    chance of any denial is{' '}
                    <strong>{formatPercent(customCapChance)}</strong>, and the
                    expected number of denied requests is{' '}
                    <strong>{formatExpectedDenials(customCapExpectedDenials)}</strong>.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
