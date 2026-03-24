import { useState } from 'react'
import { licenseHistory } from './data/licenseHistory'

const NORMAL_MODEL_MIN_RECORDS = 40
const TWO_PI = 2 * Math.PI

function uniqueValues(records, key) {
  return [...new Set(records.map((record) => record[key]))].sort()
}

function formatPercent(value) {
  const roundedValue = Math.round(value * 10) / 10

  if (roundedValue === 100 && value < 100) {
    return '~100.0%'
  }

  return `${roundedValue.toFixed(1)}%`
}

function formatExpectedDenials(value) {
  const roundedValue = Math.round(value * 10) / 10
  return Number.isInteger(roundedValue)
    ? `${roundedValue}`
    : `${roundedValue.toFixed(1)}`
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getHistoricalDenialChance(records, cap) {
  if (!records.length || cap < 1) {
    return null
  }

  const denialDates = records.filter((record) => record.totalRequests > cap).length
  return (denialDates / records.length) * 100
}

function getHistoricalExpectedDenials(records, cap) {
  if (!records.length || cap < 1) {
    return null
  }

  const totalDeniedRequests = records.reduce((sum, record) => {
    return sum + Math.max(record.totalRequests - cap, 0)
  }, 0)

  return totalDeniedRequests / records.length
}

function getRequestStats(records) {
  if (!records.length) {
    return null
  }

  const mean =
    records.reduce((sum, record) => sum + record.totalRequests, 0) / records.length
  const variance =
    records.reduce((sum, record) => {
      return sum + (record.totalRequests - mean) ** 2
    }, 0) / records.length

  return {
    mean,
    standardDeviation: Math.sqrt(variance),
  }
}

function getStandardNormalDensity(zValue) {
  return Math.exp(-0.5 * zValue * zValue) / Math.sqrt(TWO_PI)
}

function getErf(value) {
  const sign = value < 0 ? -1 : 1
  const absoluteValue = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * absoluteValue)

  const approximation =
    1 -
    (((((1.061405429 * t + -1.453152027) * t + 1.421413741) * t + -0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-absoluteValue * absoluteValue))

  return sign * approximation
}

function getStandardNormalCdf(zValue) {
  return 0.5 * (1 + getErf(zValue / Math.sqrt(2)))
}

function getNormalDenialChance(stats, cap) {
  if (!stats || cap < 1) {
    return null
  }

  if (stats.standardDeviation === 0) {
    return stats.mean > cap ? 100 : 0
  }

  const zValue = (cap - stats.mean) / stats.standardDeviation
  return clamp((1 - getStandardNormalCdf(zValue)) * 100, 0, 100)
}

function getNormalExpectedDenials(stats, cap) {
  if (!stats || cap < 1) {
    return null
  }

  if (stats.standardDeviation === 0) {
    return Math.max(stats.mean - cap, 0)
  }

  const zValue = (cap - stats.mean) / stats.standardDeviation
  const tailProbability = 1 - getStandardNormalCdf(zValue)
  const expectedDenials =
    stats.standardDeviation * getStandardNormalDensity(zValue) +
    (stats.mean - cap) * tailProbability

  return Math.max(expectedDenials, 0)
}

function getEstimator(records) {
  if (!records.length) {
    return null
  }

  if (records.length < NORMAL_MODEL_MIN_RECORDS) {
    return {
      method: 'historical',
      getDenialChance: (cap) => getHistoricalDenialChance(records, cap),
      getExpectedDenials: (cap) => getHistoricalExpectedDenials(records, cap),
    }
  }

  const stats = getRequestStats(records)

  return {
    method: 'normal',
    stats,
    getDenialChance: (cap) => getNormalDenialChance(stats, cap),
    getExpectedDenials: (cap) => getNormalExpectedDenials(stats, cap),
  }
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

function buildCapRows(estimator, currentCap) {
  if (!estimator || currentCap === null) {
    return []
  }

  const startingCap = Math.max(1, currentCap - 2)

  return Array.from({ length: 5 }, (_, index) => {
    const cap = startingCap + index

    return {
      cap,
      denialChance: estimator.getDenialChance(cap),
      expectedDenials: estimator.getExpectedDenials(cap),
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
                The percentage is the chance that requests would go over the
                selected cap, and expected denials is the average number of requests
                that would be denied at that cap.
              </p>
              {matchingRecords.length ? (
                <>
                  <p className="current-cap-note">
                    {usesNormalModel
                      ? `This license has ${matchingRecords.length} records, so the app uses a normal distribution fitted to the request history.`
                      : `This license has ${matchingRecords.length} records, so the app uses the direct historical rate from those records.`}
                  </p>
                  <p className="current-cap-note">
                    Current cap from the most recent record on {mostRecentRecord.date}:{' '}
                    <strong>{baselineCap}</strong>
                  </p>
                </>
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
                    <strong>{formatPercent(customCapChance)}</strong>, and the
                    expected number of denied requests is{' '}
                    <strong>
                      {formatExpectedDenials(customCapExpectedDenials)}
                    </strong>.
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
