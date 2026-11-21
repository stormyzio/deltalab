import { serve } from '@hono/node-server'
import { apiApp } from './api.ts'
import { getDb } from './db.ts'

const PORT = Number(process.env.DELTALAB_API_PORT ?? 3001)

// Initialize & seed SQLite database eagerly on boot
getDb()

serve(
  {
    fetch: apiApp.fetch,
    port: PORT,
    hostname: '127.0.0.1',
  },
  (info) => {
    console.log(`[DeltaLab API] SQLite ready on http://127.0.0.1:${info.port}`)
  },
)
