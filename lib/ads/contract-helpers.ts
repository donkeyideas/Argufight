import { prisma } from '@/lib/db/prisma'
import { updateCreatorYearlyEarnings } from '@/lib/taxes/updateYearlyEarnings'
import { ContractStatus, Prisma } from '@prisma/client'

/**
 * Update an ad contract and automatically update creator yearly earnings if needed
 * Use this function instead of directly calling prisma.adContract.update()
 * 
 * @param contractId - The contract ID to update
 * @param data - The update data
 * @returns The updated contract
 */
export async function updateAdContract(
  contractId: string,
  data: Prisma.AdContractUpdateInput
) {
  // Get the contract first to check if we need to update earnings
  const contract = await prisma.adContract.findUnique({
    where: { id: contractId },
    select: {
      creatorId: true,
      status: true,
      payoutSent: true,
    },
  })

  if (!contract) {
    throw new Error(`Contract ${contractId} not found`)
  }

  // Update the contract
  const updatedContract = await prisma.adContract.update({
    where: { id: contractId },
    data,
  })

  // Check if we need to update yearly earnings
  const shouldUpdateEarnings =
    // Contract just completed
    ((data.status as any) === 'COMPLETED' && contract.status !== 'COMPLETED') ||
    // Payout just sent
    (data.payoutSent === true && contract.payoutSent !== true) ||
    // Payout date just set
    (data.payoutDate && !contract.payoutSent)

  if (shouldUpdateEarnings) {
    // Update yearly earnings in the background (don't block the response)
    updateCreatorYearlyEarnings(contract.creatorId).catch((error) => {
      console.error(
        `[updateAdContract] Failed to update yearly earnings for creator ${contract.creatorId}:`,
        error
      )
    })
  }

  return updatedContract
}

/**
 * Update multiple contracts (bulk operation)
 * Automatically updates yearly earnings for affected creators
 */
export async function updateAdContracts(
  updates: Array<{
    contractId: string
    data: Prisma.AdContractUpdateInput
  }>
) {
  const results = []
  const creatorIdsToUpdate = new Set<string>()

  for (const update of updates) {
    const contract = await prisma.adContract.findUnique({
      where: { id: update.contractId },
      select: {
        creatorId: true,
        status: true,
        payoutSent: true,
      },
    })

    if (!contract) {
      console.warn(`Contract ${update.contractId} not found, skipping`)
      continue
    }

    const updatedContract = await prisma.adContract.update({
      where: { id: update.contractId },
      data: update.data as Prisma.AdContractUpdateInput,
    })

    results.push(updatedContract)

    // Check if we need to update yearly earnings
    const shouldUpdateEarnings =
      ((update.data.status as any) === 'COMPLETED' && contract.status !== 'COMPLETED') ||
      (update.data.payoutSent === true && contract.payoutSent !== true) ||
      (update.data.payoutDate && !contract.payoutSent)

    if (shouldUpdateEarnings) {
      creatorIdsToUpdate.add(contract.creatorId)
    }
  }

  // Update yearly earnings for all affected creators
  for (const creatorId of creatorIdsToUpdate) {
    updateCreatorYearlyEarnings(creatorId).catch((error) => {
      console.error(
        `[updateAdContracts] Failed to update yearly earnings for creator ${creatorId}:`,
        error
      )
    })
  }

  return results
}
