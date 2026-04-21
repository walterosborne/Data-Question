import type { LicenseRecord } from '../types'

type RecordSeed = {
  UsageDate: string
  count: number
  network: string
  vendorname: string
  featurename: string
  licensetotal: number
  requestPattern: number[]
}

function buildWeeklyDates(UsageDate: string, count: number): string[] {
  const dates: string[] = []
  const start = new Date(`${UsageDate}T00:00:00Z`)

  for (let index = 0; index < count; index += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index * 7)
    dates.push(date.toISOString().slice(0, 10))
  }

  return dates
}

function createRecords({
  UsageDate,
  count,
  network,
  vendorname,
  featurename,
  licensetotal,
  requestPattern,
}: RecordSeed): LicenseRecord[] {
  return buildWeeklyDates(UsageDate, count).map((date, index) => {
    const numbernormal = requestPattern[index % requestPattern.length]

    return {
      UsageDate: date,
      network,
      vendorname,
      featurename,
      licensetotal,
      numbernormal,
      numberdenials: Math.max(numbernormal - licensetotal, 0),
    }
  })
}

export const licenseHistory: LicenseRecord[] = [
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 50,
    network: 'East Region',
    vendorname: 'Acme Systems',
    featurename: 'Design Pro',
    licensetotal: 8,
    requestPattern: [7, 9, 11, 8, 10, 6, 9, 12, 8, 11],
  }),
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 6,
    network: 'East Region',
    vendorname: 'Acme Systems',
    featurename: 'Data Modeler',
    licensetotal: 5,
    requestPattern: [4, 6, 7, 5, 8, 6],
  }),
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 50,
    network: 'East Region',
    vendorname: 'Beacon Tech',
    featurename: 'Analytics Hub',
    licensetotal: 12,
    requestPattern: [10, 12, 14, 13, 9, 15, 11, 16, 12, 14],
  }),
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 6,
    network: 'West Region',
    vendorname: 'Northstar Apps',
    featurename: 'Planner X',
    licensetotal: 6,
    requestPattern: [5, 7, 8, 6, 9, 7],
  }),
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 50,
    network: 'West Region',
    vendorname: 'Northstar Apps',
    featurename: 'Planner XL',
    licensetotal: 9,
    requestPattern: [8, 10, 12, 9, 11, 13, 10, 14, 11, 12],
  }),
  ...createRecords({
    UsageDate: '2025-01-03',
    count: 38,
    network: 'West Region',
    vendorname: 'Skyline Software',
    featurename: 'Secure Access',
    licensetotal: 15,
    requestPattern: [12, 15, 16, 17, 14, 18, 15, 19, 16, 17],
  }),
]
