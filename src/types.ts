export type LicenseRecord = {
  date: string
  network: string
  vendor: string
  license: string
  licensesAvailable: number
  totalRequests: number
  deniedRequests: number
}

export type FilterKey = 'network' | 'vendor' | 'license'

export type RequestStats = {
  mean: number
  standardDeviation: number
}

export type EstimatorMethod = 'historical' | 'normal'

export type Estimator = {
  method: EstimatorMethod
  stats?: RequestStats
  getDenialChance: (cap: number) => number | null
  getExpectedDenials: (cap: number) => number | null
}

export type CapRow = {
  cap: number
  denialChance: number
  expectedDenials: number
}
