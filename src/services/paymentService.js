const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PaymentService {
  /**
   * Record a new payment against an Outward Invoice
   */
  static async recordPayment(invoiceId, data) {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify invoice exists
      const invoice = await tx.outwardInvoice.findUnique({
        where: { id: parseInt(invoiceId) },
        include: { items: { include: { product: { include: { category: true } } } } }
      });
      if (!invoice) throw new Error('Outward Invoice not found');

      // Calculate invoice grand total to check outstanding balance
      let baseCost = 0;
      let gstCost = 0;
      invoice.items?.forEach((item) => {
        const gstRate = item.product?.category?.gstRate || 0;
        const itemBase = item.quantity * item.ratePerUnit;
        const itemGst = (itemBase * gstRate) / 100;
        baseCost += itemBase;
        gstCost += itemGst;
      });

      const expense = invoice.expense || 0;
      const adjustment = invoice.adjustment || 0;
      const shippingCharge = invoice.shippingCharge || 0;
      const grandTotal = baseCost + gstCost + expense + shippingCharge - adjustment;
      const currentPaid = invoice.amountReceived || 0;
      const remainingBalance = grandTotal - currentPaid;

      const paymentAmount = parseFloat(data.amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Payment amount must be a positive number');
      }

      // Check if payment amount exceeds outstanding balance
      // Allow minor floating point inaccuracy (e.g. 0.01)
      if (paymentAmount > remainingBalance + 0.01) {
        throw new Error(`Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding balance (₹${remainingBalance.toFixed(2)})`);
      }

      // 2. Generate sequential Receipt Number (e.g., REC-000001)
      const lastReceipt = await tx.paymentReceipt.findFirst({
        orderBy: { id: 'desc' },
      });
      
      let nextNum = 1;
      if (lastReceipt) {
        const match = lastReceipt.receiptNo.match(/\d+/);
        if (match) {
          nextNum = parseInt(match[0]) + 1;
        }
      }
      const receiptNo = `REC-${nextNum.toString().padStart(6, '0')}`;

      // 3. Create the PaymentReceipt record
      const receipt = await tx.paymentReceipt.create({
        data: {
          receiptNo,
          outwardInvoiceId: parseInt(invoiceId),
          amount: paymentAmount,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          paymentMethod: data.paymentMethod || 'UPI',
          transactionId: data.transactionId || null,
          notes: data.notes || null,
        },
      });

      // 4. Update the Outward Invoice's total amountReceived
      const allPayments = await tx.paymentReceipt.findMany({
        where: { outwardInvoiceId: parseInt(invoiceId) },
      });
      const totalAmountReceived = allPayments.reduce((sum, p) => sum + p.amount, 0);

      await tx.outwardInvoice.update({
        where: { id: parseInt(invoiceId) },
        data: {
          amountReceived: totalAmountReceived,
        },
      });

      return receipt;
    });
  }

  /**
   * Get all payments recorded for a specific Outward Invoice
   */
  static async getPaymentsForInvoice(invoiceId) {
    return await prisma.paymentReceipt.findMany({
      where: { outwardInvoiceId: parseInt(invoiceId) },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * Get a single Payment Receipt by ID
   */
  static async getPaymentReceiptById(id) {
    const receipt = await prisma.paymentReceipt.findUnique({
      where: { id: parseInt(id) },
      include: {
        outwardInvoice: {
          include: {
            customer: true,
            items: {
              include: {
                product: { include: { category: true } }
              }
            },
            paymentReceipts: {
              orderBy: { paymentDate: 'asc' }
            }
          }
        }
      }
    });

    if (!receipt) throw new Error('Payment Receipt not found');
    return receipt;
  }
}

module.exports = { PaymentService };
