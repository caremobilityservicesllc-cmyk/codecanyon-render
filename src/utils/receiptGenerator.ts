import { format, parseISO } from 'date-fns';

interface BusinessInfoData {
  companyName?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  taxId?: string;
  registrationNumber?: string;
}

interface ReceiptData {
  bookingReference: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string | Date;
  pickupTime: string;
  passengers: number;
  vehicleName: string;
  totalPrice: number | null;
  serviceType: string;
  transferType: string;
  paymentMethod: string;
  notes?: string | null;
  createdAt?: string;
  formatPrice?: (amount: number) => string;
  businessInfo?: BusinessInfoData;
}

const transferTypeLabels: Record<string, string> = {
  'one-way': 'One Way',
  'return': 'Return Trip',
  'return-new-ride': 'Return (New Ride)',
};

const paymentMethodLabels: Record<string, string> = {
  'card': 'Credit/Debit Card',
  'paypal': 'PayPal',
  'bank': 'Bank Transfer',
};

export function generateReceiptHTML(data: ReceiptData): string {
  const formattedDate = typeof data.pickupDate === 'string' 
    ? format(parseISO(data.pickupDate), 'MMMM d, yyyy')
    : format(data.pickupDate, 'MMMM d, yyyy');
  
  const invoiceDate = data.createdAt 
    ? format(parseISO(data.createdAt), 'MMMM d, yyyy')
    : format(new Date(), 'MMMM d, yyyy');

  const invoiceNumber = `INV-${data.bookingReference}`;

  const biz = data.businessInfo || {};
  const companyName = biz.companyName || 'RideFlow';
  const tagline = biz.tagline || 'Premium Transportation Services';
  const bizEmail = biz.email || '';
  const bizPhone = biz.phone || '';
  const bizAddress = biz.address || '';
  const bizWebsite = biz.website || '';
  const bizTaxId = biz.taxId || '';
  const bizRegNumber = biz.registrationNumber || '';

  const businessDetailsLines: string[] = [];
  if (bizAddress) businessDetailsLines.push(bizAddress);
  if (bizPhone) businessDetailsLines.push(`Tel: ${bizPhone}`);
  if (bizEmail) businessDetailsLines.push(`Email: ${bizEmail}`);
  if (bizWebsite) businessDetailsLines.push(bizWebsite);
  const taxRegLines: string[] = [];
  if (bizTaxId) taxRegLines.push(`Tax ID: ${bizTaxId}`);
  if (bizRegNumber) taxRegLines.push(`Reg: ${bizRegNumber}`);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receipt - ${data.bookingReference}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: #f5f5f5;
          padding: 20px;
        }
        .receipt {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #1a1a1a 0%, #333 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 5px;
        }
        .header .tagline {
          opacity: 0.8;
          font-size: 14px;
          margin-bottom: 0;
        }
        .business-details {
          text-align: center;
          padding: 15px 30px;
          background: #f0f0f0;
          border-bottom: 1px solid #e0e0e0;
          font-size: 12px;
          color: #555;
          line-height: 1.8;
        }
        .business-details .tax-reg {
          margin-top: 4px;
          font-size: 11px;
          color: #888;
        }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          padding: 20px 30px;
          background: #f9f9f9;
          border-bottom: 1px solid #eee;
        }
        .invoice-info div {
          text-align: center;
        }
        .invoice-info label {
          display: block;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .invoice-info span {
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
        }
        .content {
          padding: 30px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid #f0f0f0;
        }
        .route {
          display: flex;
          align-items: flex-start;
          gap: 15px;
        }
        .route-line {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 4px;
        }
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #C9A227;
        }
        .line {
          width: 2px;
          height: 30px;
          background: #ddd;
          margin: 4px 0;
        }
        .dot.end {
          background: #1a1a1a;
        }
        .route-details {
          flex: 1;
        }
        .location {
          margin-bottom: 20px;
        }
        .location label {
          font-size: 11px;
          color: #999;
          text-transform: uppercase;
        }
        .location p {
          font-weight: 500;
          color: #1a1a1a;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        .detail-item {
          background: #f9f9f9;
          padding: 12px 15px;
          border-radius: 8px;
        }
        .detail-item label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        .detail-item span {
          font-weight: 600;
          color: #1a1a1a;
        }
        .total-section {
          background: linear-gradient(135deg, #f9f9f9 0%, #f0f0f0 100%);
          padding: 20px;
          border-radius: 12px;
          margin-top: 20px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }
        .total-row.main {
          border-top: 2px solid #ddd;
          margin-top: 10px;
          padding-top: 15px;
        }
        .total-row label {
          color: #666;
        }
        .total-row span {
          font-weight: 600;
        }
        .total-row.main label {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .total-row.main span {
          font-size: 24px;
          color: #C9A227;
        }
        .footer {
          text-align: center;
          padding: 25px 30px;
          background: #f9f9f9;
          border-top: 1px solid #eee;
        }
        .footer p {
          font-size: 13px;
          color: #666;
          margin-bottom: 5px;
        }
        .footer .thank-you {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .receipt {
            box-shadow: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>${companyName}</h1>
          <p class="tagline">${tagline}</p>
        </div>
        
        ${businessDetailsLines.length > 0 || taxRegLines.length > 0 ? `
        <div class="business-details">
          ${businessDetailsLines.map(line => `<div>${line}</div>`).join('')}
          ${taxRegLines.length > 0 ? `<div class="tax-reg">${taxRegLines.join(' | ')}</div>` : ''}
        </div>
        ` : ''}
        
        <div class="invoice-info">
          <div>
            <label>Invoice Number</label>
            <span>${invoiceNumber}</span>
          </div>
          <div>
            <label>Invoice Date</label>
            <span>${invoiceDate}</span>
          </div>
          <div>
            <label>Booking Ref</label>
            <span>${data.bookingReference}</span>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <div class="section-title">Trip Route</div>
            <div class="route">
              <div class="route-line">
                <div class="dot"></div>
                <div class="line"></div>
                <div class="dot end"></div>
              </div>
              <div class="route-details">
                <div class="location">
                  <label>Pickup</label>
                  <p>${data.pickupLocation}</p>
                </div>
                <div class="location" style="margin-bottom: 0;">
                  <label>Drop-off</label>
                  <p>${data.dropoffLocation}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Trip Details</div>
            <div class="details-grid">
              <div class="detail-item">
                <label>Date</label>
                <span>${formattedDate}</span>
              </div>
              <div class="detail-item">
                <label>Time</label>
                <span>${data.pickupTime}</span>
              </div>
              <div class="detail-item">
                <label>Passengers</label>
                <span>${data.passengers}</span>
              </div>
              <div class="detail-item">
                <label>Vehicle</label>
                <span>${data.vehicleName}</span>
              </div>
              <div class="detail-item">
                <label>Service Type</label>
                <span>${data.serviceType === 'hourly' ? 'Hourly' : 'Flat Rate'}</span>
              </div>
              <div class="detail-item">
                <label>Transfer Type</label>
                <span>${transferTypeLabels[data.transferType] || data.transferType}</span>
              </div>
            </div>
          </div>
          
          ${data.notes ? `
          <div class="section">
            <div class="section-title">Special Instructions</div>
            <p style="color: #666; font-size: 14px;">${data.notes}</p>
          </div>
          ` : ''}
          
          <div class="total-section">
            <div class="total-row">
              <label>Payment Method</label>
              <span>${paymentMethodLabels[data.paymentMethod] || data.paymentMethod}</span>
            </div>
            <div class="total-row main">
              <label>Total Amount</label>
              <span>${data.formatPrice ? data.formatPrice(Number(data.totalPrice) || 0) : (data.totalPrice ? Number(data.totalPrice).toFixed(2) : '0.00')}</span>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p class="thank-you">Thank you for choosing ${companyName}!</p>
          <p>For any questions, please contact our support team.</p>
          ${bizEmail ? `<p>${bizEmail}</p>` : ''}
          ${bizPhone ? `<p>${bizPhone}</p>` : ''}
          <p>This receipt was generated electronically and is valid without signature.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function downloadReceipt(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReceiptAsPDF(data: ReceiptData): void {
  const html = generateReceiptHTML(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Create download link for HTML file (user can print to PDF)
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${data.bookingReference}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
