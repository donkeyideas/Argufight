import { CreatorTaxInfo } from '@prisma/client'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface Generate1099Options {
  taxInfo: CreatorTaxInfo
  taxYear: number
  totalCompensation: number
}

export async function generate1099PDF({
  taxInfo,
  taxYear,
  totalCompensation,
}: Generate1099Options): Promise<Buffer> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // Letter size (8.5 x 11 inches in points)
  
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const fontSize = 10
  const fontSizeSmall = 8
  const fontSizeLarge = 12
  const fontSizeTitle = 16
  const margin = 50
  let y = height - margin

  // Form Title
  const titleText = 'Form 1099-NEC'
  const titleWidth = fontBold.widthOfTextAtSize(titleText, fontSizeTitle)
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y,
    font: fontBold,
    size: fontSizeTitle,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  const compText = 'Nonemployee Compensation'
  const compWidth = font.widthOfTextAtSize(compText, fontSize)
  page.drawText(compText, {
    x: (width - compWidth) / 2,
    y,
    font,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  const copyText = 'Copy B - For Recipient'
  const copyWidth = font.widthOfTextAtSize(copyText, fontSizeSmall)
  page.drawText(copyText, {
    x: (width - copyWidth) / 2,
    y,
    font,
    size: fontSizeSmall,
    color: rgb(0, 0, 0),
  })
  y -= 20

  // Year
  const yearText = `Tax Year ${taxYear}`
  const yearWidth = fontBold.widthOfTextAtSize(yearText, fontSizeLarge)
  page.drawText(yearText, {
    x: (width - yearWidth) / 2,
    y,
    font: fontBold,
    size: fontSizeLarge,
    color: rgb(0, 0, 0),
  })
  y -= 25

  // Payer Information (Your Company)
  page.drawText('PAYER\'S name, street address, city, state, ZIP code, and telephone no.', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  page.drawText('Honorable.AI', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  page.drawText('123 Main Street', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  page.drawText('San Francisco, CA 94105', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  page.drawText('(555) 123-4567', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 25

  // Payer's TIN (Tax ID)
  page.drawText('PAYER\'S TIN', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  page.drawText('XX-XXXXXXX', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 30

  // Recipient Information
  page.drawText('RECIPIENT\'S name', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  page.drawText(taxInfo.legalName || 'N/A', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 20

  if (taxInfo.businessName) {
    page.drawText('RECIPIENT\'S business name (if different from above)', {
      x: margin,
      y,
      font: fontBold,
      size: fontSize,
      color: rgb(0, 0, 0),
    })
    y -= 20
    
    page.drawText(taxInfo.businessName, {
      x: margin,
      y,
      font,
      size: 9,
      color: rgb(0, 0, 0),
    })
    y -= 20
  }

  // Recipient's Address
  page.drawText('RECIPIENT\'S street address, city, state, ZIP code', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  // Address fields not in schema - using empty strings
  page.drawText('', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  page.drawText('', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 15
  
  page.drawText('', {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 30

  // Recipient's TIN
  page.drawText('RECIPIENT\'S TIN', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  // taxId field not in schema - using N/A
  const formattedTaxId = 'N/A'
  
  page.drawText(formattedTaxId, {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 30

  // Account Number (optional)
  page.drawText('Account number (optional)', {
    x: margin,
    y,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  y -= 20
  
  page.drawText(taxInfo.creatorId.slice(0, 8), {
    x: margin,
    y,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  y -= 30

  // Helper function to format currency with commas
  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Box 1: Nonemployee compensation
  const boxY = y
  const boxWidth = 250
  const boxHeight = 50
  
  // Draw box border
  page.drawRectangle({
    x: margin,
    y: boxY - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  
  // Box number
  page.drawText('1', {
    x: margin + 8,
    y: boxY - 18,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  
  // Label text
  const label1 = 'Nonemployee compensation'
  page.drawText(label1, {
    x: margin + 25,
    y: boxY - 18,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  
  // Amount - right aligned
  const amount1 = formatCurrency(totalCompensation)
  const amount1Width = fontBold.widthOfTextAtSize(amount1, fontSizeLarge)
  page.drawText(amount1, {
    x: margin + boxWidth - amount1Width - 10,
    y: boxY - 35,
    font: fontBold,
    size: fontSizeLarge,
    color: rgb(0, 0, 0),
  })
  
  y = boxY - boxHeight - 5

  // Box 2: Federal income tax withheld (if applicable)
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  })
  
  // Box number
  page.drawText('2', {
    x: margin + 8,
    y: y - 18,
    font: fontBold,
    size: fontSize,
    color: rgb(0, 0, 0),
  })
  
  // Label text
  const label2 = 'Federal income tax withheld'
  page.drawText(label2, {
    x: margin + 25,
    y: y - 18,
    font,
    size: 9,
    color: rgb(0, 0, 0),
  })
  
  // Amount - right aligned
  const amount2 = formatCurrency(0)
  const amount2Width = fontBold.widthOfTextAtSize(amount2, fontSizeLarge)
  page.drawText(amount2, {
    x: margin + boxWidth - amount2Width - 10,
    y: y - 35,
    font: fontBold,
    size: fontSizeLarge,
    color: rgb(0, 0, 0),
  })

  // Footer
  const footerY = 50
  const footerText1 = 'This form is provided for your records. Keep it for your tax records.'
  const footerWidth1 = font.widthOfTextAtSize(footerText1, fontSizeSmall)
  page.drawText(footerText1, {
    x: (width - footerWidth1) / 2,
    y: footerY + 15,
    font,
    size: fontSizeSmall,
    color: rgb(0, 0, 0),
  })
  
  const footerText2 = 'For more information about Form 1099-NEC, visit www.irs.gov/form1099nec'
  const footerWidth2 = font.widthOfTextAtSize(footerText2, fontSizeSmall)
  page.drawText(footerText2, {
    x: (width - footerWidth2) / 2,
    y: footerY,
    font,
    size: fontSizeSmall,
    color: rgb(0, 0, 0),
  })

  // Serialize the PDF to bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
