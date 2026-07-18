import 'dotenv/config'
import { prisma } from '../src/db/prisma.js'

async function main() {
  const result = await prisma.vessel.updateMany({
    where: { vesselStatus: { not: 'IN_MANAGEMENT' } },
    data: { vesselStatus: 'IN_MANAGEMENT' },
  })
  console.info(`Vessel status update complete. ${result.count} record(s) marked active.`)
}

main()
  .catch((error) => {
    console.error('Vessel status update failed.', error instanceof Error ? error.message : 'Unknown database error')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
