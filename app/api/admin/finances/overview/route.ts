import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/session-utils'
import { prisma } from '@/lib/db/prisma'
import { createStripeClient, getStripeKeys } from '@/lib/stripe/stripe-client'
import Stripe from 'stripe'


export async function GET(request: NextRequest) {
  try {
    const userId = await verifyAdmin()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Stripe mode
    const { secretKey } = await getStripeKeys()
    const isTestMode = secretKey?.startsWith('sk_test_') || false

    // Get date range from query params (default to last 30 days)
    const searchParams = request.nextUrl.searchParams
    let startDate: Date
    let endDate = new Date()
    
    if (searchParams.get('startDate') && searchParams.get('endDate')) {
      // Custom date range
      startDate = new Date(searchParams.get('startDate')!)
      endDate = new Date(searchParams.get('endDate')!)
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999)
    } else {
      // Quick filter (days)
      const days = parseInt(searchParams.get('days') || '30')
      startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)
    }

    // ===== SUBSCRIPTION REVENUE =====
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        tier: 'PRO',
        status: 'ACTIVE',
        createdAt: { gte: startDate },
      },
      include: {
        user: {
          select: { email: true, username: true },
        },
      },
    })

    // Get subscription payments from Stripe
    let subscriptionRevenue = 0
    let subscriptionCount = 0
    const subscriptionTransactions: any[] = []

    console.log(`[Finances] Fetching invoices from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    if (secretKey) {
      try {
        const stripe = await createStripeClient()
        
        // Get all successful invoices (including subscription and one-time payments)
        // Fetch more invoices to ensure we don't miss any
        let allInvoices: Stripe.Invoice[] = []
        let hasMore = true
        let startingAfter: string | undefined = undefined
        
        while (hasMore && allInvoices.length < 1000) {
          const invoiceList = await stripe.invoices.list({
            limit: 100,
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000),
            },
            status: 'paid',
            expand: ['data.subscription', 'data.customer'],
            starting_after: startingAfter,
          }) as Stripe.Response<Stripe.ApiList<Stripe.Invoice>>
          
          allInvoices = [...allInvoices, ...invoiceList.data]
          hasMore = invoiceList.has_more
          if (invoiceList.data.length > 0) {
            startingAfter = invoiceList.data[invoiceList.data.length - 1].id
          } else {
            hasMore = false
          }
        }

        console.log(`[Finances] Found ${allInvoices.length} paid invoices`)
        
        for (const invoice of allInvoices) {
          // Check if this is a subscription invoice
          const subscriptionId = (invoice as any).subscription 
            ? (typeof (invoice as any).subscription === 'string' 
                ? (invoice as any).subscription 
                : ((invoice as any).subscription as Stripe.Subscription)?.id)
            : null
          
          // Check if invoice has subscription line items
          const hasSubscriptionLine = invoice.lines?.data?.some((line: any) => line.type === 'subscription')
          
          // Only count subscription-related invoices (for subscription revenue)
          // But we'll include all paid invoices in transactions
          if (subscriptionId || hasSubscriptionLine) {
            const amount = invoice.amount_paid / 100 // Convert from cents
            
            // Only count as subscription revenue if it has a subscription
            if (subscriptionId) {
              subscriptionRevenue += amount
              subscriptionCount++
            }
            
            // Try to find matching subscription in database
            const subscription = subscriptionId 
              ? subscriptions.find(s => s.stripeSubscriptionId === subscriptionId)
              : null
            
            // Get customer email from invoice
            let customerEmail: string | null = null
            if (typeof invoice.customer === 'string') {
              // Customer is just an ID, need to fetch it
              try {
                const customer = await stripe.customers.retrieve(invoice.customer)
                if (!customer.deleted && 'email' in customer) {
                  customerEmail = customer.email
                }
              } catch (e) {
                // Ignore errors fetching customer
              }
            } else if (invoice.customer && 'email' in invoice.customer) {
              customerEmail = invoice.customer.email
            }
            
            if (!customerEmail) {
              customerEmail = invoice.customer_email
            }
            
            // If subscription not found in DB, try to find user by email
            let userInfo = subscription?.user
            if (!userInfo && customerEmail) {
              try {
                const userByEmail = await prisma.user.findFirst({
                  where: { email: customerEmail },
                  select: { email: true, username: true },
                })
                if (userByEmail) {
                  userInfo = userByEmail
                }
              } catch (e) {
                // Ignore errors
              }
            }
            
            // Fallback to email if we have it
            if (!userInfo) {
              userInfo = { 
                email: customerEmail || 'Unknown', 
                username: customerEmail ? customerEmail.split('@')[0] : 'Unknown' 
              }
            }
            
            const invoiceAny = invoice as any
            subscriptionTransactions.push({
              id: invoice.id,
              type: 'subscription',
              amount,
              stripeFee: invoiceAny.application_fee_amount ? invoiceAny.application_fee_amount / 100 : 0,
              netAmount: amount - (invoiceAny.application_fee_amount ? invoiceAny.application_fee_amount / 100 : 0),
              date: new Date(invoice.created * 1000),
              user: userInfo,
              subscriptionId: subscriptionId,
              invoiceUrl: invoiceAny.hosted_invoice_url,
            })
            
            console.log(`[Finances] Added invoice ${invoice.id}: $${amount} (subscription: ${subscriptionId || 'none'})`)
          }
        }
        
        console.log(`[Finances] Total subscription revenue: $${subscriptionRevenue} from ${subscriptionCount} subscriptions`)
        
        // Also check checkout sessions for completed payments that might not have invoices yet
        try {
          const checkoutSessions = await stripe.checkout.sessions.list({
            limit: 100,
            created: {
              gte: Math.floor(startDate.getTime() / 1000),
              lte: Math.floor(endDate.getTime() / 1000),
            },
            status: 'complete',
            expand: ['data.customer', 'data.subscription'],
          })
          
          console.log(`[Finances] Found ${checkoutSessions.data.length} completed checkout sessions`)
          
          for (const session of checkoutSessions.data) {
            // Only process if payment was successful and has amount
            if (session.payment_status === 'paid' && session.amount_total) {
              const amount = session.amount_total / 100
              const subscriptionId = typeof session.subscription === 'string' 
                ? session.subscription 
                : (session.subscription as Stripe.Subscription)?.id
              
              // Check if we already counted this in invoices
              const alreadyCounted = subscriptionTransactions.some(
                t => t.subscriptionId === subscriptionId && Math.abs(t.amount - amount) < 0.01
              )
              
              if (!alreadyCounted && subscriptionId) {
                // This is a subscription payment we haven't counted yet
                subscriptionRevenue += amount
                subscriptionCount++
                
                const subscription = subscriptions.find(s => s.stripeSubscriptionId === subscriptionId)
                let customerEmail: string | null = null
                
                if (typeof session.customer === 'string') {
                  try {
                    const customer = await stripe.customers.retrieve(session.customer)
                    if (!customer.deleted && 'email' in customer) {
                      customerEmail = customer.email || null
                    }
                  } catch (e) {
                    // Ignore
                  }
                } else if (session.customer && 'email' in session.customer) {
                  customerEmail = session.customer.email || null
                }
                
                // Also check customer_details from checkout session
                if (!customerEmail && session.customer_details?.email) {
                  customerEmail = session.customer_details.email
                }
                
                // Check metadata for userId
                let userIdFromMetadata: string | null = null
                if (session.metadata?.userId) {
                  userIdFromMetadata = session.metadata.userId
                }
                
                // Try to find user
                let userInfo = subscription?.user
                if (!userInfo) {
                  // Try by userId from metadata
                  if (userIdFromMetadata) {
                    try {
                      const userById = await prisma.user.findUnique({
                        where: { id: userIdFromMetadata },
                        select: { email: true, username: true },
                      })
                      if (userById) {
                        userInfo = userById
                      }
                    } catch (e) {
                      // Ignore
                    }
                  }
                  
                  // Try by email
                  if (!userInfo && customerEmail) {
                    try {
                      const userByEmail = await prisma.user.findFirst({
                        where: { email: customerEmail },
                        select: { email: true, username: true },
                      })
                      if (userByEmail) {
                        userInfo = userByEmail
                      }
                    } catch (e) {
                      // Ignore
                    }
                  }
                }
                
                // Fallback to email if we have it
                if (!userInfo) {
                  userInfo = { 
                    email: customerEmail || 'Unknown', 
                    username: customerEmail ? customerEmail.split('@')[0] : 'Unknown' 
                  }
                }
                
                subscriptionTransactions.push({
                  id: session.id,
                  type: 'subscription',
                  amount,
                  stripeFee: 0,
                  netAmount: amount,
                  date: new Date(session.created * 1000),
                  user: userInfo,
                  subscriptionId: subscriptionId,
                  source: 'checkout_session',
                })
                
                console.log(`[Finances] Added checkout session ${session.id}: $${amount}`)
              }
            }
          }
        } catch (checkoutError) {
          console.error('Error fetching checkout sessions:', checkoutError)
        }
      } catch (error) {
        console.error('Error fetching Stripe invoices:', error)
        // Log more details for debugging
        if (error instanceof Error) {
          console.error('Error details:', error.message, error.stack)
        }
      }
    }

    // ===== ADVERTISEMENT REVENUE =====
    // Get creator marketplace contracts (signed within date range)
    const contracts = await prisma.adContract.findMany({
      where: {
        signedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        advertiser: {
          select: { companyName: true, contactEmail: true },
        },
        creator: {
          select: { username: true, email: true },
        },
        campaign: {
          select: { name: true },
        },
      },
    })

    // Get Platform Ads campaign payments
    // Include campaigns that have been paid (paidAt exists and is within date range)
    const platformAdsCampaigns = await prisma.campaign.findMany({
      where: {
        type: 'PLATFORM_ADS',
        paymentStatus: 'PAID',
        paidAt: {
          not: null,
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        advertiser: {
          select: { companyName: true, contactEmail: true },
        },
      },
    })
    
    console.log(`[Finances] Query params: startDate=${startDate.toISOString()}, endDate=${endDate.toISOString()}`)
    console.log(`[Finances] Found ${contracts.length} creator marketplace contracts`)
    console.log(`[Finances] Found ${platformAdsCampaigns.length} Platform Ads campaigns with paidAt in date range`)

    let adRevenue = 0
    let platformFees = 0
    let creatorPayouts = 0
    const adTransactions: any[] = []

    // Process creator marketplace contracts
    for (const contract of contracts) {
      const totalAmount = Number(contract.totalAmount)
      const platformFee = Number(contract.platformFee)
      const creatorPayout = Number(contract.creatorPayout)

      adRevenue += totalAmount
      platformFees += platformFee
      creatorPayouts += creatorPayout

      adTransactions.push({
        id: contract.id,
        type: 'advertisement',
        amount: totalAmount,
        platformFee,
        creatorPayout,
        date: contract.signedAt,
        advertiser: contract.advertiser,
        creator: contract.creator,
        campaign: contract.campaign,
        status: contract.status,
        payoutSent: contract.payoutSent,
      })
    }

    // Process Platform Ads campaign payments
    // Note: campaigns are already filtered by paidAt in date range from query
    for (const campaign of platformAdsCampaigns) {
      const budget = Number(campaign.budget)

      // For Platform Ads, the entire budget is revenue (no creator payout)
      // Stripe fees are already included in what advertiser paid
      adRevenue += budget
      // Platform keeps 100% of Platform Ads revenue (no creator payout)

      // Calculate Stripe fee that was paid (for reference)
      const stripeFee = budget * 0.029 + 0.30
      const totalPaid = budget + stripeFee

      adTransactions.push({
        id: campaign.id,
        type: 'platform_ad',
        amount: budget,
        platformFee: 0, // Platform keeps all revenue
        creatorPayout: 0, // No creator involved
        stripeFee: stripeFee,
        totalPaid: totalPaid,
        date: campaign.paidAt,
        advertiser: campaign.advertiser,
        creator: null,
        campaign: { name: campaign.name },
        status: campaign.status,
        payoutSent: false,
        stripePaymentId: campaign.stripePaymentId,
      })
    }

    // ===== STRIPE BALANCE =====
    let stripeBalance = 0
    let pendingBalance = 0
    let availableBalance = 0

    if (secretKey) {
      try {
        const stripe = await createStripeClient()
        const balance = await stripe.balance.retrieve()
        
        stripeBalance = balance.available[0]?.amount ? balance.available[0].amount / 100 : 0
        pendingBalance = balance.pending[0]?.amount ? balance.pending[0].amount / 100 : 0
        availableBalance = stripeBalance
      } catch (error) {
        console.error('Error fetching Stripe balance:', error)
      }
    }

    // ===== CALCULATE TOTALS =====
    const totalRevenue = subscriptionRevenue + adRevenue
    const totalFees = platformFees // Platform fees from ads
    const totalPayouts = creatorPayouts

    // Calculate total Stripe fees from all transactions
    const totalStripeFees = adTransactions
      .filter(tx => tx.type === 'platform_ad' && tx.stripeFee)
      .reduce((sum, tx) => sum + tx.stripeFee, 0)

    // Net revenue = Total revenue - Creator payouts - Stripe fees
    const netRevenue = totalRevenue - totalPayouts - totalStripeFees

    // ===== RECENT TRANSACTIONS =====
    const allTransactions = [
      ...subscriptionTransactions,
      ...adTransactions,
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 50)

    // ===== VALIDATION LOGGING =====
    console.log(`[Finances] Summary for ${startDate.toISOString()} to ${endDate.toISOString()}:`)
    console.log(`  - Subscription Revenue: $${subscriptionRevenue.toFixed(2)} (${subscriptionCount} payments)`)
    console.log(`  - Advertisement Revenue: $${adRevenue.toFixed(2)} (${adTransactions.length} transactions)`)
    console.log(`  - Total Revenue: $${totalRevenue.toFixed(2)}`)
    console.log(`  - Platform Fees: $${totalFees.toFixed(2)}`)
    console.log(`  - Stripe Fees: $${totalStripeFees.toFixed(2)}`)
    console.log(`  - Creator Payouts: $${totalPayouts.toFixed(2)}`)
    console.log(`  - Net Revenue: $${netRevenue.toFixed(2)}`)

    return NextResponse.json({
      isTestMode,
      period: {
        startDate,
        endDate,
      },
      revenue: {
        subscriptions: {
          total: subscriptionRevenue,
          count: subscriptionCount,
          transactions: subscriptionTransactions,
        },
        advertisements: {
          total: adRevenue,
          count: adTransactions.length, // Count actual ad revenue transactions
          transactions: adTransactions,
        },
        total: totalRevenue,
      },
      fees: {
        platform: totalFees,
        stripe: totalStripeFees, // Total Stripe fees from all transactions
      },
      payouts: {
        creators: totalPayouts,
        // Count only payouts that were sent within the selected date range
        count: contracts.filter(c => c.payoutSent && c.payoutDate && c.payoutDate >= startDate && c.payoutDate <= endDate).length,
      },
      net: {
        revenue: netRevenue,
        balance: availableBalance,
        pending: pendingBalance,
      },
      transactions: allTransactions,
    })
  } catch (error: any) {
    console.error('Failed to fetch finances overview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch finances overview' },
      { status: 500 }
    )
  }
}

