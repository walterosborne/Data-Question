import type {
  CapRow,
  Estimator,
  FilterKey,
  LicenseRecord,
  RequestStats,
} from '../types'

export const NORMAL_MODEL_MIN_RECORDS = 40

const TWO_PI = 2 * Math.PI

export function uniqueValues(records: LicenseRecord[], key: FilterKey): string[] {
  return [...new Set(records.map((record) => record[key]))].sort()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getHistoricalDenialChance(
  records: LicenseRecord[],
  cap: number,
): number | null {
  if (!records.length || cap < 1) {
    return null
  }

  const denialDates = records.filter((record) => record.peakusage > cap).length
  return (denialDates / records.length) * 100
}

function getHistoricalExpectedDenials(
  records: LicenseRecord[],
  cap: number,
): number | null {
  if (!records.length || cap < 1) {
    return null
  }

  const totalDeniedRequests = records.reduce((sum, record) => {
    return sum + Math.max(record.peakusage - cap, 0)
  }, 0)

  return totalDeniedRequests / records.length
}

function getRequestStats(records: LicenseRecord[]): RequestStats | null {
  if (!records.length) {
    return null
  }

  const mean =
    records.reduce((sum, record) => sum + record.peakusage, 0) / records.length
  const variance =
    records.reduce((sum, record) => {
      return sum + (record.peakusage - mean) ** 2
    }, 0) / records.length

  return {
    mean,
    standardDeviation: Math.sqrt(variance),
  }
}

function getStandardNormalDensity(zValue: number): number {
  return Math.exp(-0.5 * zValue * zValue) / Math.sqrt(TWO_PI)
}

function getErf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const absoluteValue = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * absoluteValue)

  // Abramowitz-Stegun style approximation for erf(x).
  const approximation =
    1 -
    (((((1.061405429 * t + -1.453152027) * t + 1.421413741) * t + -0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-absoluteValue * absoluteValue))

  return sign * approximation
}

function getStandardNormalCdf(zValue: number): number {
  return 0.5 * (1 + getErf(zValue / Math.sqrt(2)))
}

function getNormalDenialChance(stats: RequestStats | null, cap: number): number | null {
  if (!stats || cap < 1) {
    return null
  }

  if (stats.standardDeviation === 0) {
    return stats.mean > cap ? 100 : 0
  }

  const zValue = (cap - stats.mean) / stats.standardDeviation
  return clamp((1 - getStandardNormalCdf(zValue)) * 100, 0, 100)
}

function getNormalExpectedDenials(
  stats: RequestStats | null,
  cap: number,
): number | null {
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

export function getEstimator(records: LicenseRecord[]): Estimator | null {
  if (!records.length) {
    return null
  }

  if (records.length < NORMAL_MODEL_MIN_RECORDS) {
    return {
      method: 'historical',
      getDenialChance: (cap: number) => getHistoricalDenialChance(records, cap),
      getExpectedDenials: (cap: number) => getHistoricalExpectedDenials(records, cap),
    }
  }

  const stats = getRequestStats(records)

  return {
    method: 'normal',
    stats: stats ?? undefined,
    getDenialChance: (cap: number) => getNormalDenialChance(stats, cap),
    getExpectedDenials: (cap: number) => getNormalExpectedDenials(stats, cap),
  }
}

export function getMostRecentRecord(records: LicenseRecord[]): LicenseRecord | null {
  if (!records.length) {
    return null
  }

  return records.reduce<LicenseRecord | null>((latestRecord, record) => {
    if (!latestRecord || record.UsageDate > latestRecord.UsageDate) {
      return record
    }

    return latestRecord
  }, null)
}

export function buildCapRows(
  estimator: Estimator | null,
  currentCap: number | null,
): CapRow[] {
  if (!estimator || currentCap === null) {
    return []
  }

  const startingCap = Math.max(1, currentCap - 2)

  return Array.from({ length: 5 }, (_, index) => {
    const cap = startingCap + index
    const denialChance = estimator.getDenialChance(cap)
    const expectedDenials = estimator.getExpectedDenials(cap)

    if (denialChance === null || expectedDenials === null) {
      throw new Error('Estimator returned null for a valid cap.')
    }

    return {
      cap,
      denialChance,
      expectedDenials,
    }
  })
}
