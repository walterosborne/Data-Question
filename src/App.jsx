import { useState } from 'react'
import { licenseHistory } from './data/licenseHistory'

function uniqueValues(records, key) {
  return [...new Set(records.map((record) => record[key]))].sort()
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

function formatCustomPercent(value) {
  const roundedValue = Math.round(value * 10) / 10
  return Number.isInteger(roundedValue)
    ? `${roundedValue}%`
    : `${roundedValue.toFixed(1)}%`
}

function getDenialChance(records, cap) {
  if (!records.length || cap < 1) {
    return null
  }

  const denialDates = records.filter((record) => record.totalRequests > cap).length
  return (denialDates / records.length) * 100
}

function getMostRecentRecord(records) {
  if (!records.length) {
    return null
  }

  return records.reduce((latestRecord, record) => {
    if (!latestRecord || record.date > latestRecord.date) {
      return record
    }

    return latestRecord
  }, null)
}

function buildCapRows(records, currentCap) {
  if (!records.length || currentCap === null) {
    return []
  }

  const startingCap = Math.max(1, currentCap - 2)

  return Array.from({ length: 5 }, (_, index) => {
    const cap = startingCap + index

    return {
      cap,
      denialChance: getDenialChance(records, cap),
    }
  })
}

const networks = uniqueValues(licenseHistory, 'network')

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState(networks[0] ?? '')
  const [selectedVendor, setSelectedVendor] = useState('')
  const [selectedLicense, setSelectedLicense] = useState('')
  const [customCap, setCustomCap] = useState('')

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
  const capRows = buildCapRows(matchingRecords, baselineCap)
  const customCapValue = Number(customCap)
  const customCapChance = Number.isInteger(customCapValue)
    ? getDenialChance(matchingRecords, customCapValue)
    : null

  function handleNetworkChange(event) {
    setSelectedNetwork(event.target.value)
    setSelectedVendor('')
    setSelectedLicense('')
    setCustomCap('')
  }

  function handleVendorChange(event) {
    setSelectedVendor(event.target.value)
    setSelectedLicense('')
    setCustomCap('')
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
                onChange={(event) => {
                  setSelectedLicense(event.target.value)
                  setCustomCap('')
                }}
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
                The percentage is the share of historical dates when total requests
                would have gone over the selected cap, which means denials would
                have happened.
              </p>
              {matchingRecords.length ? (
                <p className="current-cap-note">
                  Current cap from the most recent record on {mostRecentRecord.date}:{' '}
                  <strong>{baselineCap}</strong>
                </p>
              ) : null}
            </div>

            <div className="results-panel">
              {matchingRecords.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Possible License Cap</th>
                        <th>Chance of Any Denial</th>
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

          {matchingRecords.length ? (
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
                  onChange={(event) => setCustomCap(event.target.value)}
                  placeholder="Enter a cap"
                />
              </label>

              <div className="custom-cap-result">
                {customCap === '' ? (
                  <p>Enter a number to calculate the estimate.</p>
                ) : customCapChance === null ? (
                  <p>Please enter a whole number greater than 0.</p>
                ) : (
                  <p>
                    At a cap of <strong>{customCapValue}</strong>, the estimated
                    chance of any denial is{' '}
                    <strong>{formatCustomPercent(customCapChance)}</strong>.
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
