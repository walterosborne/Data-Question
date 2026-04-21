import express from 'express'

import { getLicenseHistory } from './sqlServer'

const PORT = Number(process.env.PORT ?? 3001)

const app = express()

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/license-history', async (_request, response) => {
  try {
    const records = await getLicenseHistory()
    response.json(records)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load license history.'

    console.error(error)
    response.status(500).json({ message })
  }
})

app.listen(PORT, () => {
  console.log(`License backend listening on http://localhost:${PORT}`)
})
