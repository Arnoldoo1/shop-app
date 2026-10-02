module.exports = function (app, supabase, handle) {
  const env = process.env
  const isProd = () => env.MPESA_ENV === 'production'
  const BASE = () => (isProd() ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke')

  const configured = () =>
    env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY

  function timestamp() {
    const d = new Date(Date.now() + 3 * 3600 * 1000)
    const p = (n) => String(n).padStart(2, '0')
    return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds())
  }

  function normalizePhone(raw) {
    let n = String(raw || '').replace(/[\s+-]/g, '')
    if (n.startsWith('0')) n = '254' + n.slice(1)
    if (/^[71]\d{8}$/.test(n)) n = '254' + n
    return n
  }

  async function getToken() {
    const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString('base64')
    const r = await fetch(`${BASE()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.access_token) throw new Error('Could not connect to M-Pesa. Check your Daraja keys.')
    return j.access_token
  }

  async function loadOrder(id) {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }

  // Sends the payment prompt
  app.post('/api/orders/:id/mpesa', handle(async (req, res) => {
    if (!configured()) return res.status(503).json({ error: 'M-Pesa is not set up yet.' })
    const order = await loadOrder(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (order.payment_method !== 'mpesa') return res.status(400).json({ error: 'This order is not an M-Pesa order.' })
    if (order.payment_status === 'paid') return res.json({ status: 'paid' })

    const typed = normalizePhone((req.body && req.body.phone) || order.phone)
    if (!/^254[71]\d{8}$/.test(typed)) {
      return res.status(400).json({ error: 'Enter a valid Safaricom number, e.g. 0712345678.' })
    }
    const phone = isProd() ? typed : (env.MPESA_TEST_PHONE || '254708374149')

    const ts = timestamp()
    const password = Buffer.from(env.MPESA_SHORTCODE + env.MPESA_PASSKEY + ts).toString('base64')
    const token = await getToken()

    const r = await fetch(`${BASE()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: ts,
        TransactionType: env.MPESA_TXN_TYPE || 'CustomerPayBillOnline',
        Amount: order.total,
        PartyA: phone,
        PartyB: env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: env.MPESA_CALLBACK_URL || 'https://example.com/api/mpesa/callback',
        AccountReference: 'DUKA' + order.id.slice(0, 6).toUpperCase(),
        TransactionDesc: 'Order payment',
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.ResponseCode !== '0') {
      return res.status(502).json({ error: j.errorMessage || j.ResponseDescription || 'M-Pesa request failed. Try again.' })
    }
    await supabase.from('orders')
      .update({ payment_reference: j.CheckoutRequestID, payment_status: 'pending' })
      .eq('id', order.id)
    res.json({ status: 'pending', message: j.CustomerMessage })
  }))

  // Checks if the payment went through
  app.get('/api/orders/:id/payment-status', handle(async (req, res) => {
    const order = await loadOrder(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    if (order.payment_status !== 'pending' || order.payment_method !== 'mpesa') {
      return res.json({ status: order.payment_status })
    }
    if (!order.payment_reference || !configured()) return res.json({ status: 'pending' })

    try {
      const ts = timestamp()
      const password = Buffer.from(env.MPESA_SHORTCODE + env.MPESA_PASSKEY + ts).toString('base64')
      const token = await getToken()
      const r = await fetch(`${BASE()}/mpesa/stkpushquery/v1/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          BusinessShortCode: env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: ts,
          CheckoutRequestID: order.payment_reference,
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (j.ResultCode === undefined) return res.json({ status: 'pending' })
      if (String(j.ResultCode) === '0') {
        await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', order.id)
        return res.json({ status: 'paid' })
      }
      await supabase.from('orders').update({ payment_status: 'failed' }).eq('id', order.id)
      return res.json({ status: 'failed', message: j.ResultDesc || 'Payment was not completed.' })
    } catch (e) {
      return res.json({ status: 'pending' })
    }
  }))

  // SANDBOX ONLY: lets you demonstrate a successful payment. Disabled in production.
  app.post('/api/orders/:id/sandbox-confirm', handle(async (req, res) => {
    if (isProd()) return res.status(403).json({ error: 'Not available in live mode.' })
    const order = await loadOrder(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found.' })
    await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', order.id)
    res.json({ status: 'paid' })
  }))

  // Safaricom calls this once the shop is online
  app.post('/api/mpesa/callback', handle(async (req, res) => {
    if (!env.MPESA_CALLBACK_KEY || req.query.key !== env.MPESA_CALLBACK_KEY) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const cb = req.body && req.body.Body && req.body.Body.stkCallback
    if (cb && cb.CheckoutRequestID) {
      await supabase.from('orders')
        .update({ payment_status: cb.ResultCode === 0 ? 'paid' : 'failed' })
        .eq('payment_reference', cb.CheckoutRequestID)
        .eq('payment_status', 'pending')
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }))
}
