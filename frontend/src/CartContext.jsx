import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { useAuth } from './AuthContext'

export const FREE_DELIVERY_OVER = 5000
export const DELIVERY_FEE = 300
export const money = (n) => `KES ${Number(n).toLocaleString()}`

const CartContext = createContext(null)
export const useCart = () => useContext(CartContext)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const userId = user ? user.id : null
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart')) || [] } catch { return [] }
  })
  const pending = useRef(0)
  const prevUser = useRef(null)

  // Guests keep their cart in the browser. Signed-in users keep it in the database.
  useEffect(() => {
    if (userId) return
    try { localStorage.setItem('cart', JSON.stringify(items)) } catch { /* ignore */ }
  }, [items, userId])

  const pull = useCallback(async () => {
    if (pending.current > 0) return
    const rows = await api.getCart()
    setItems(rows.map((r) => ({ product: r.product, quantity: r.quantity })))
  }, [])

  // When someone signs in: merge their guest cart into the account cart, then load it
  useEffect(() => {
    if (!userId) {
      if (prevUser.current) setItems([])
      prevUser.current = null
      return undefined
    }
    prevUser.current = userId
    let cancelled = false
    ;(async () => {
      try {
        let guest = []
        try { guest = JSON.parse(localStorage.getItem('cart')) || [] } catch { guest = [] }
        pending.current += 1
        try {
          if (guest.length) {
            const server = await api.getCart()
            const have = new Set(server.map((r) => r.product_id))
            for (const g of guest) {
              if (!have.has(g.product.id)) await api.setCartItem(g.product.id, g.quantity)
            }
          }
        } finally {
          pending.current -= 1
        }
        try { localStorage.removeItem('cart') } catch { /* ignore */ }
        if (!cancelled) await pull()
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [userId, pull])

  // Keep the cart fresh so items added on the phone appear on the web (and the reverse)
  useEffect(() => {
    if (!userId) return undefined
    const refresh = () => {
      if (document.visibilityState === 'visible') pull().catch(() => {})
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 10000)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(timer)
    }
  }, [userId, pull])

  function sync(fn) {
    if (!userId) return
    pending.current += 1
    Promise.resolve()
      .then(fn)
      .catch(() => {})
      .finally(() => { pending.current -= 1 })
  }

  const add = (product, qty = 1) => {
    const found = items.find((i) => i.product.id === product.id)
    const q = Math.min((found ? found.quantity : 0) + qty, product.stock, 20)
    setItems((cur) =>
      found
        ? cur.map((i) => (i.product.id === product.id ? { ...i, product, quantity: q } : i))
        : [...cur, { product, quantity: q }]
    )
    sync(() => api.setCartItem(product.id, q))
  }

  const setQty = (id, qty) => {
    const found = items.find((i) => i.product.id === id)
    if (!found) return
    const q = Math.max(1, Math.min(qty, found.product.stock, 20))
    setItems((cur) => cur.map((i) => (i.product.id === id ? { ...i, quantity: q } : i)))
    sync(() => api.setCartItem(id, q))
  }

  const remove = (id) => {
    setItems((cur) => cur.filter((i) => i.product.id !== id))
    sync(() => api.removeCartItem(id))
  }

  const clear = () => {
    setItems([])
    sync(() => api.clearCart())
  }

  const count = items.reduce((n, i) => n + i.quantity, 0)
  const subtotal = items.reduce((n, i) => n + i.product.price * i.quantity, 0)
  const delivery = items.length === 0 || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE
  const total = subtotal + delivery

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count, subtotal, delivery, total }}>
      {children}
    </CartContext.Provider>
  )
}
