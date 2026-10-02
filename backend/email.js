const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (n) => 'KES ' + Number(n).toLocaleString('en-US')

const PAY_TEXT = { mpesa: 'M-Pesa', cod: 'Pay on delivery' }

function buildEmail(order) {
  const shop = process.env.SHOP_NAME || 'Duka Hub'
  const ref = '#' + order.id.slice(0, 8).toUpperCase()
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} x ${i.quantity}</td><td style="padding:6px 0;text-align:right">${money(i.price * i.quantity)}</td></tr>`)
    .join('')

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
    <h2 style="color:#4f46e5;margin-bottom:4px">${esc(shop)}</h2>
    <h3>Thank you, ${esc(order.customer_name.split(' ')[0])}! Your order is confirmed.</h3>
    <p>Order number: <strong>${ref}</strong></p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb">${rows}</table>
    <table style="width:100%;margin-top:8px">
      <tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>
      <tr><td>Delivery</td><td style="text-align:right">${order.delivery_fee === 0 ? 'Free' : money(order.delivery_fee)}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${money(order.total)}</strong></td></tr>
    </table>
    <p><strong>Payment:</strong> ${esc(PAY_TEXT[order.payment_method] || order.payment_method)} (${esc(order.payment_status)})</p>
    <p><strong>Delivery to:</strong><br>${esc(order.customer_name)}<br>${esc(order.address)}, ${esc(order.city)}<br>${esc(order.phone)}</p>
    <p style="color:#6b7280;font-size:13px">Questions? Reply to this email and quote your order number.</p>
  </div>`

  const text =
    `Thank you, ${order.customer_name}! Your order ${ref} is confirmed.\n\n` +
    order.items.map((i) => `${i.name} x ${i.quantity} - ${money(i.price * i.quantity)}`).join('\n') +
    `\n\nTotal: ${money(order.total)}\nPayment: ${PAY_TEXT[order.payment_method] || order.payment_method} (${order.payment_status})\n` +
    `Delivery to: ${order.address}, ${order.city}\n`

  return { subject: `Order ${ref} confirmed - ${shop}`, html, text }
}

// Never throws: a failed email must not break the order
async function sendOrderEmail(order) {
  const { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_REGION, MAIL_FROM } = process.env
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log('Email skipped: Mailgun is not configured.')
    return { sent: false }
  }
  try {
    const base = MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'
    const mail = buildEmail(order)
    const body = new URLSearchParams({
      from: MAIL_FROM || `Duka Hub <postmaster@${MAILGUN_DOMAIN}>`,
      to: order.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    const r = await fetch(`${base}/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64') },
      body,
    })
    if (!r.ok) {
      console.error('Mailgun error', r.status, (await r.text()).slice(0, 200))
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error('Email failed:', err.message)
    return { sent: false }
  }
}

module.exports = { sendOrderEmail }
