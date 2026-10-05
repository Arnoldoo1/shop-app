require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')
const { sendOrderEmail } = require('./email')

const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const FREE_DELIVERY_OVER = 5000
const DELIVERY_FEE = 300
const PAYMENT_METHODS = ['mpesa', 'cod']

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

async function getUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const { data, error } = await supabase.auth.getUser(token)
    return error ? null : data.user
  } catch {
    return null
  }
}

app.get('/', (req, res) => res.json({ message: 'Shop API is running' }))

app.get('/api/config', (req, res) =>
  res.json({ mpesa_env: process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox' })
)

// ---------- PRODUCTS ----------
app.get('/api/products', handle(async (req, res) => {
  let query = supabase.from('products').select('*').order('created_at', { ascending: true })
  if (req.query.category) query = query.eq('category', req.query.category)
  if (req.query.search) {
    const term = String(req.query.search).replace(/[%,()]/g, ' ').trim()
    if (term) query = query.ilike('name', `%${term}%`)
  }
  const { data, error } = await query
  if (error) throw error
  res.json(data)
}))

app.get('/api/categories', handle(async (req, res) => {
  const { data, error } = await supabase.from('products').select('category')
  if (error) throw error
  res.json([...new Set(data.map((p) => p.category))].sort())
}))

app.get('/api/products/:slug', handle(async (req, res) => {
  const { data, error } = await supabase
    .from('products').select('*').eq('slug', req.params.slug).maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: 'Product not found' })
  res.json(data)
}))

// ---------- ORDERS ----------
app.post('/api/orders', handle(async (req, res) => {
  const b = req.body || {}
  const clean = (v) => String(v || '').trim()

  const customer = {
    customer_name: clean(b.customer_name),
    email: clean(b.email).toLowerCase(),
    phone: clean(b.phone).replace(/[\s-]/g, ''),
    address: clean(b.address),
    city: clean(b.city),
    notes: clean(b.notes) || null,
  }
  const paymentMethod = b.payment_method || 'mpesa'

  if (customer.customer_name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return res.status(400).json({ error: 'Please enter a valid email address.' })
  if (!/^\+?\d{9,15}$/.test(customer.phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' })
  if (customer.address.length < 3) return res.status(400).json({ error: 'Please enter your delivery address.' })
  if (customer.city.length < 2) return res.status(400).json({ error: 'Please enter your town or city.' })
  if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ error: 'Invalid payment method.' })

  const items = Array.isArray(b.items) ? b.items : []
  if (items.length === 0 || items.length > 50) return res.status(400).json({ error: 'Your cart is empty.' })

  const wanted = new Map()
  for (const it of items) {
    const qty = Number(it.quantity)
    if (!it.product_id || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: 'Invalid item in cart.' })
    }
    wanted.set(it.product_id, (wanted.get(it.product_id) || 0) + qty)
  }

  const ids = [...wanted.keys()]
  const { data: products, error: pErr } = await supabase.from('products').select('*').in('id', ids)
  if (pErr) throw pErr
  if (products.length !== ids.length) return res.status(400).json({ error: 'A product in your cart no longer exists.' })

  let subtotal = 0
  for (const p of products) {
    const qty = wanted.get(p.id)
    if (p.stock < qty) {
      return res.status(400).json({ error: `Sorry, only ${p.stock} of "${p.name}" left in stock.` })
    }
    subtotal += p.price * qty
  }
  const delivery_fee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE
  const total = subtotal + delivery_fee

  const reserved = []
  async function rollback() {
    for (const r of reserved) {
      await supabase.from('products').update({ stock: r.oldStock }).eq('id', r.id)
    }
  }
  for (const p of products) {
    const qty = wanted.get(p.id)
    const { data: updated, error } = await supabase
      .from('products').update({ stock: p.stock - qty })
      .eq('id', p.id).eq('stock', p.stock).select('id')
    if (error || !updated || updated.length === 0) {
      await rollback()
      return res.status(409).json({ error: 'Stock just changed. Please try again.' })
    }
    reserved.push({ id: p.id, oldStock: p.stock })
  }

  const user = await getUser(req)
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      ...customer,
      user_id: user ? user.id : null,
      subtotal, delivery_fee, total,
      payment_method: paymentMethod,
      payment_status: 'pending',
      order_status: 'placed',
    })
    .select().single()
  if (oErr) { await rollback(); throw oErr }

  const rows = products.map((p) => ({
    order_id: order.id, product_id: p.id, name: p.name, price: p.price, quantity: wanted.get(p.id),
  }))
  const { error: iErr } = await supabase.from('order_items').insert(rows)
  if (iErr) {
    await supabase.from('orders').delete().eq('id', order.id)
    await rollback()
    throw iErr
  }

  await sendOrderEmail({ ...order, items: rows })
  res.status(201).json({ ...order, items: rows })
}))

app.get('/api/orders/mine', handle(async (req, res) => {
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Please sign in.' })
  const { data, error } = await supabase
    .from('orders').select('*, order_items(*)')
    .eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw error
  res.json(data)
}))

require('./mpesa')(app, supabase, handle)

require('./cart')(app, supabase, handle)

if (require.main === module) {
  const PORT = process.env.PORT || 5001
  app.listen(PORT, () => console.log(`Shop API running on http://localhost:${PORT}`))
}

module.exports = app
