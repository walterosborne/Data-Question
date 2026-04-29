import type {
  CapRow,
  Estimator,
  FilterKey,
  LicenseRecord,
} from '../types'

export function uniqueValues(records: LicenseRecord[], key: FilterKey): string[] {
  return [...new Set(records.map((record) => record[key]))].sort()
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

export function getEstimator(records: LicenseRecord[]): Estimator | null {
  if (!records.length) {
    return null
  }

  return {
    method: 'historical',
    getDenialChance: (cap: number) => getHistoricalDenialChance(records, cap),
    getExpectedDenials: (cap: number) => getHistoricalExpectedDenials(records, cap),
  }
}

export function getCapClosestToTargetDenialChance(
  records: LicenseRecord[],
  targetChance: number,
): number | null {
  const estimator = getEstimator(records)

  if (!estimator) {
    return null
  }

  const maxCap = Math.max(...records.map((record) => record.peakusage), 1)
  let closestCap: number | null = null
  let closestDifference = Number.POSITIVE_INFINITY

  for (let cap = 1; cap <= maxCap; cap += 1) {
    const denialChance = estimator.getDenialChance(cap)

    if (denialChance === null) {
      continue
    }

    const difference = Math.abs(denialChance - targetChance)

    if (
      difference < closestDifference ||
      (difference === closestDifference && closestCap !== null && cap < closestCap)
    ) {
      closestCap = cap
      closestDifference = difference
    }
  }

  return closestCap
}

export function getAveragePeakUsage(records: LicenseRecord[]): number | null {
  if (!records.length) {
    return null
  }

  const totalPeakUsage = records.reduce((sum, record) => sum + record.peakusage, 0)
  return totalPeakUsage / records.length
}

export function buildCapRows(
  estimator: Estimator | null,
  centerCap: number | null,
): CapRow[] {
  if (!estimator || centerCap === null) {
    return []
  }

  const startingCap = Math.max(1, centerCap - 2)

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
