import { useState, type ChangeEvent } from 'react'
import { licenseHistory } from './data/licenseHistory'
import {
  buildCapRows,
  getEstimator,
  getMostRecentRecord,
  uniqueValues,
} from './lib/licenseEstimator'

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

const networks = uniqueValues(licenseHistory, 'network')

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState<string>(networks[0] ?? '')
  const [selectedVendor, setSelectedVendor] = useState<string>('')
  const [selectedLicense, setSelectedLicense] = useState<string>('')
  const [customCap, setCustomCap] = useState<string>('')

  const vendorOptions = uniqueValues(
    licenseHistory.filter((record) => record.network === selectedNetwork),
    'vendor',
  )

  const licenseOptions = uniqueValues(
    licenseHistory.filter(
      (record) =>
        record.network === selectedNetwork && record.vendor === selectedVendor,
    ),
    'license',
  )

  const matchingRecords = licenseHistory.filter(
    (record) =>
      record.network === selectedNetwork &&
      record.vendor === selectedVendor &&
      record.license === selectedLicense,
  )

  const mostRecentRecord = getMostRecentRecord(matchingRecords)
  const baselineCap = mostRecentRecord?.licensesAvailable ?? null
  const estimator = getEstimator(matchingRecords)
  const usesNormalModel = estimator?.method === 'normal'
  const capRows = buildCapRows(estimator, baselineCap)
  const customCapValue = Number(customCap)
  const customCapChance = Number.isInteger(customCapValue)
    ? estimator?.getDenialChance(customCapValue) ?? null
    : null
  const customCapExpectedDenials = Number.isInteger(customCapValue)
    ? estimator?.getExpectedDenials(customCapValue) ?? null
    : null

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
              <select value={selectedNetwork} onChange={handleNetworkChange}>
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
                disabled={!vendorOptions.length}
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
                disabled={!licenseOptions.length}
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
                The percentage is the chance that requests would go over the
                selected cap, and expected denials is the average number of requests
                that would be denied at that cap.
              </p>
              {matchingRecords.length > 0 ? (
                <>
                  <p className="current-cap-note">
                    {usesNormalModel
                      ? `This license has ${matchingRecords.length} records, so the app uses a normal distribution fitted to the request history.`
                      : `This license has ${matchingRecords.length} records, so the app uses the direct historical rate from those records.`}
                  </p>
                  {mostRecentRecord ? (
                    <p className="current-cap-note">
                      Current cap from the most recent record on {mostRecentRecord.date}:{' '}
                      <strong>{baselineCap}</strong>
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="results-panel">
              {matchingRecords.length > 0 ? (
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
