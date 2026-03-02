/**
 * Calculate Stripe transaction fees
 * Stripe charges: 2.9% + $0.30 per transaction
 * 
 * @param amount - Base amount in dollars
 * @returns Object with base amount, fee, and total
 */
export function calculateStripeFees(amount: number): {
  baseAmount: number
  fee: number
  total: number
} {
  // Stripe fee structure: 2.9% + $0.30
  const percentageFee = amount * 0.029 // 2.9%
  const fixedFee = 0.30 // $0.30
  const fee = percentageFee + fixedFee
  
  // Round fee to 2 decimal places
  const roundedFee = Math.round(fee * 100) / 100
  
  // Total amount advertiser pays
  const total = amount + roundedFee
  
  return {
    baseAmount: amount,
    fee: roundedFee,
    total: Math.round(total * 100) / 100, // Round to 2 decimal places
  }
}

/**
 * Calculate the base amount from a total that includes Stripe fees
 * This is useful when you have the total and need to extract the base amount
 */
export function calculateBaseFromTotal(total: number): {
  baseAmount: number
  fee: number
  total: number
} {
  // Reverse calculation: total = base + (base * 0.029) + 0.30
  // total = base * 1.029 + 0.30
  // base = (total - 0.30) / 1.029
  const baseAmount = (total - 0.30) / 1.029
  const fee = total - baseAmount
  
  return {
    baseAmount: Math.round(baseAmount * 100) / 100,
    fee: Math.round(fee * 100) / 100,
    total,
  }
}

