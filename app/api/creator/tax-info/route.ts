import { NextRequest, NextResponse } from 'next/server'
import { verifySessionWithDb } from '@/lib/auth/session-verify'
import { prisma } from '@/lib/db/prisma'

// GET /api/creator/tax-info - Get creator tax information
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    console.log('[Tax Info API] === START ===', new Date().toISOString())
    console.log('[Tax Info API] Request URL:', request.url)
    const session = await verifySessionWithDb()
    console.log('[Tax Info API] Session:', session ? `found, userId: ${session.userId}` : 'not found')
    
    if (!session) {
      console.log('[Tax Info API] No session, returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.userId
    console.log('[Tax Info API] UserId:', userId)
    
    if (!userId) {
      console.log('[Tax Info API] No userId, returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create tax info
    let taxInfo
    try {
      // First try without the relation to see if basic query works
      taxInfo = await prisma.creatorTaxInfo.findUnique({
        where: { creatorId: userId },
      })
      console.log('[Tax Info API] Found tax info:', taxInfo ? 'yes' : 'no')
    } catch (error: any) {
      console.error('[Tax Info API] Error finding tax info:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      })
      throw error
    }

    // If no tax info exists, create a basic record
    if (!taxInfo) {
      try {
        taxInfo = await prisma.creatorTaxInfo.create({
          data: {
            creatorId: userId,
            stripeAccountId: `temp_${userId}`,
            yearlyEarnings: {},
          },
        })
        // Manually set empty array for tax forms
        ;(taxInfo as any).taxForms1099 = []
        console.log('[Tax Info API] Created new tax info record')
      } catch (error: any) {
        console.error('[Tax Info API] Error creating tax info:', {
          message: error.message,
          code: error.code,
        })
        throw error
      }
    }

    // Get existing yearly earnings from tax info
    const yearlyEarnings = taxInfo.yearlyEarnings as Record<string, number> || {}
    console.log('[Tax Info API] Yearly earnings:', yearlyEarnings)

    // Always fetch tax forms directly from database
    let taxForms1099: Array<{
      id: any
      taxYear: any
      totalCompensation: number
      status: any
      pdfUrl: any
      generatedAt: any
      sentToCreator: any
    }> = []
    try {
      console.log('[Tax Info API] Fetching forms for taxInfo.id:', taxInfo.id)
      const forms = await prisma.taxForm1099.findMany({
        where: { creatorTaxInfoId: taxInfo.id },
        orderBy: { taxYear: 'desc' },
      })
      console.log('[Tax Info API] Found', forms.length, 'forms in database')
      
      if (forms.length > 0) {
        console.log('[Tax Info API] Forms:', forms.map(f => ({ 
          id: f.id, 
          taxYear: f.taxYear, 
          status: f.status,
          pdfUrl: f.pdfUrl ? 'yes' : 'no'
        })))
        
        taxForms1099 = forms.map((form: any) => {
          return {
            id: form.id,
            taxYear: form.taxYear,
            totalCompensation: Number(form.totalCompensation || 0),
            status: form.status,
            pdfUrl: form.pdfUrl,
            generatedAt: form.generatedAt ? (form.generatedAt instanceof Date ? form.generatedAt.toISOString() : new Date(form.generatedAt).toISOString()) : null,
            sentToCreator: form.sentToCreator || false,
          }
        })
      } else {
        console.log('[Tax Info API] No forms found in database')
      }
    } catch (error: any) {
      console.error('[Tax Info API] Error fetching tax forms:', error.message)
      console.error('[Tax Info API] Error stack:', error.stack)
      taxForms1099 = []
    }

    console.log('[Tax Info API] Final taxForms1099 array:', taxForms1099)
    console.log('[Tax Info API] Returning response with', taxForms1099.length, 'tax forms')

    const responseData = {
      w9Submitted: taxInfo.w9Submitted || false,
      w9SubmittedAt: taxInfo.w9SubmittedAt ? taxInfo.w9SubmittedAt.toISOString() : null,
      legalName: taxInfo.legalName,
      taxIdType: taxInfo.taxIdType,
      yearlyEarnings: yearlyEarnings,
      taxForms1099: taxForms1099,
    }

    console.log('[Tax Info API] Response data prepared:', {
      w9Submitted: responseData.w9Submitted,
      hasYearlyEarnings: Object.keys(responseData.yearlyEarnings).length > 0,
      taxFormsCount: responseData.taxForms1099.length,
    })

    console.log('[Tax Info API] === SUCCESS ===')
    return NextResponse.json(responseData)
  } catch (error: any) {
    console.error('[Tax Info API] === ERROR ===')
    console.error('[Tax Info API] Error message:', error.message)
    console.error('[Tax Info API] Error name:', error.name)
    console.error('[Tax Info API] Error code:', error.code)
    console.error('[Tax Info API] Error stack:', error.stack)
    console.error('[Tax Info API] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch tax information',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
