function buildWeeklyDates(startDate, count) {
  const dates = []
  const start = new Date(`${startDate}T00:00:00Z`)

  for (let index = 0; index < count; index += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index * 7)
    dates.push(date.toISOString().slice(0, 10))
  }

  return dates
}

function createRecords({
  startDate,
  count,
  network,
  vendor,
  license,
  licensesAvailable,
  requestPattern,
}) {
  return buildWeeklyDates(startDate, count).map((date, index) => {
    const totalRequests = requestPattern[index % requestPattern.length]

    return {
      date,
      network,
      vendor,
      license,
      licensesAvailable,
      totalRequests,
      deniedRequests: Math.max(totalRequests - licensesAvailable, 0),
    }
  })
}

export const licenseHistory = [
  ...createRecords({
    startDate: '2025-01-03',
    count: 50,
    network: 'East Region',
    vendor: 'Acme Systems',
    license: 'Design Pro',
    licensesAvailable: 8,
    requestPattern: [7, 9, 11, 8, 10, 6, 9, 12, 8, 11],
  }),
  ...createRecords({
    startDate: '2025-01-03',
    count: 6,
    network: 'East Region',
    vendor: 'Acme Systems',
    license: 'Data Modeler',
    licensesAvailable: 5,
    requestPattern: [4, 6, 7, 5, 8, 6],
  }),
  ...createRecords({
    startDate: '2025-01-03',
    count: 50,
    network: 'East Region',
    vendor: 'Beacon Tech',
    license: 'Analytics Hub',
    licensesAvailable: 12,
    requestPattern: [10, 12, 14, 13, 9, 15, 11, 16, 12, 14],
  }),
  ...createRecords({
    startDate: '2025-01-03',
    count: 6,
    network: 'West Region',
    vendor: 'Northstar Apps',
    license: 'Planner X',
    licensesAvailable: 6,
    requestPattern: [5, 7, 8, 6, 9, 7],
  }),
  ...createRecords({
    startDate: '2025-01-03',
    count: 50,
    network: 'West Region',
    vendor: 'Northstar Apps',
    license: 'Planner XL',
    licensesAvailable: 9,
    requestPattern: [8, 10, 12, 9, 11, 13, 10, 14, 11, 12],
  }),
  ...createRecords({
    startDate: '2025-01-03',
    count: 38,
    network: 'West Region',
    vendor: 'Skyline Software',
    license: 'Secure Access',
    licensesAvailable: 15,
    requestPattern: [12, 15, 16, 17, 14, 18, 15, 19, 16, 17],
  }),
]
