export type LicenseRecord = {
  UsageDate: string
  network: string
  vendorname: string
  featurename: string
  licensetotal: number
  peakusage: number
  numberdenials: number
}

export type FilterKey = 'network' | 'vendorname' | 'featurename'

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
