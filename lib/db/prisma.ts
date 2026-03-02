import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Runtime validation: Ensure DATABASE_URL is PostgreSQL, not SQLite
const databaseUrl = process.env.DATABASE_URL
if (databaseUrl) {
  if (databaseUrl.startsWith('file:') || databaseUrl.includes('.db')) {
    throw new Error(
      'CRITICAL: DATABASE_URL is SQLite but schema requires PostgreSQL! ' +
      'The Prisma Client was generated with the wrong provider. ' +
      'This usually means the build cache needs to be cleared on Vercel.'
    )
  }
}

function getDevDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  // In development the server is a single long-running process, not serverless.
  // connection_limit=1 causes pool exhaustion when multiple Server Components
  // run concurrent Prisma queries. Increase it for dev only.
  return url
    .replace(/connection_limit=\d+/, 'connection_limit=10')
    .replace(/pool_timeout=\d+/, 'pool_timeout=30')
}

const createPrismaClient = () => {
  const isDev = process.env.NODE_ENV === 'development'
  const client = new PrismaClient({
    log: isDev ? ['error', 'warn'] : ['error'],
    ...(isDev && {
      datasources: { db: { url: getDevDatabaseUrl() } },
    }),
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
