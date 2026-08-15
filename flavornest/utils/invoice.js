const PDFDocument = require('pdfkit');

/**
 * Streams a simple invoice PDF directly to an Express response.
 * Kept intentionally plain (no external assets/fonts) so it renders
 * identically regardless of environment.
 */
function streamInvoice(order, user, res) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);
  doc.pipe(res);

  doc.fontSize(22).text('FlavorNest', { continued: true }).fontSize(12).text('  Global Kitchen');
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555').text('Invoice / Order Receipt');
  doc.moveDown();

  doc.fillColor('#000').fontSize(11);
  doc.text(`Order ID: ${order._id}`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.text(`Customer: ${user.name} (${user.email})`);
  doc.text(`Status: ${order.status}  |  Payment: ${order.paymentStatus}`);
  doc.moveDown();

  const addr = order.deliveryAddress || {};
  doc.text('Delivery Address:');
  doc.text(`${addr.name || ''}`);
  doc.text(`${addr.line1 || ''}`);
  doc.text(`${addr.city || ''} ${addr.state || ''} ${addr.zip || ''}`);
  if (addr.phone) doc.text(`Phone: ${addr.phone}`);
  doc.moveDown();

  doc.fontSize(12).text('Items', { underline: true });
  doc.moveDown(0.3);

  order.items.forEach((item) => {
    doc
      .fontSize(10)
      .text(
        `${item.title}   x${item.quantity}   @ ${order.currency.toUpperCase()} ${item.price.toFixed(2)}   =  ${(
          item.price * item.quantity
        ).toFixed(2)}`
      );
  });

  doc.moveDown();
  doc.fontSize(11);
  doc.text(`Subtotal: ${order.currency.toUpperCase()} ${order.subtotal.toFixed(2)}`);
  doc.text(`Delivery Fee: ${order.currency.toUpperCase()} ${order.deliveryFee.toFixed(2)}`);
  doc.text(`Tax: ${order.currency.toUpperCase()} ${order.tax.toFixed(2)}`);
  doc.fontSize(13).text(`Total: ${order.currency.toUpperCase()} ${order.total.toFixed(2)}`, { underline: true });

  doc.moveDown(2);
  doc.fontSize(9).fillColor('#888').text('Thank you for ordering with FlavorNest.', { align: 'center' });

  doc.end();
}

module.exports = { streamInvoice };
