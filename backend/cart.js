module.exports = function (app, supabase, handle) {
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

  // Returns the user, or sends a 401 and returns null
  async function need(req, res) {
    const user = await getUser(req)
    if (!user) res.status(401).json({ error: 'Please sign in.' })
    return user
  }

  // The signed-in user's cart, with full product details
  app.get('/api/cart', handle(async (req, res) => {
    const user = await need(req, res)
    if (!user) return
    const { data, error } = await supabase
      .from('cart_items')
      .select('product_id, quantity, updated_at, product:products(*)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: true })
    if (error) throw error
    res.json(data.filter((r) => r.product))
  }))

  // Sets the quantity of one product in the cart (adds it if new)
  app.put('/api/cart/items/:productId', handle(async (req, res) => {
    const user = await need(req, res)
    if (!user) return
    const qty = Number(req.body && req.body.quantity)
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 20.' })
    }
    const { data: product, error: pErr } = await supabase
      .from('products').select('id,stock').eq('id', req.params.productId).maybeSingle()
    if (pErr) throw pErr
    if (!product) return res.status(404).json({ error: 'Product not found.' })
    if (product.stock < 1) return res.status(400).json({ error: 'This product is out of stock.' })
    const quantity = Math.min(qty, product.stock)
    const { error } = await supabase.from('cart_items').upsert(
      { user_id: user.id, product_id: product.id, quantity, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,product_id' }
    )
    if (error) throw error
    res.json({ product_id: product.id, quantity })
  }))

  app.delete('/api/cart/items/:productId', handle(async (req, res) => {
    const user = await need(req, res)
    if (!user) return
    const { error } = await supabase
      .from('cart_items').delete().eq('user_id', user.id).eq('product_id', req.params.productId)
    if (error) throw error
    res.status(204).end()
  }))

  app.delete('/api/cart', handle(async (req, res) => {
    const user = await need(req, res)
    if (!user) return
    const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id)
    if (error) throw error
    res.status(204).end()
  }))
}
