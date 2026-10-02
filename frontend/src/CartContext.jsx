import { createContext, useContext, useEffect, useState } from 'react'

export const FREE_DELIVERY_OVER = 5000
export const DELIVERY_FEE = 300
export const money = (n) => `KES ${Number(n).toLocaleString()}`

const CartContext = createContext(null)
export const useCart = () => useContext(CartContext)

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart')) || [] } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(items)) } catch { /* ignore */ }
  }, [items])

  const add = (product, qty = 1) =>
    setItems((cur) => {
      const found = cur.find((i) => i.product.id === product.id)
      if (found) {
        return cur.map((i) =>
          i.product.id === product.id
            ? { ...i, product, quantity: Math.min(i.quantity + qty, product.stock, 20) }
            : i
        )
      }
      return [...cur, { product, quantity: Math.min(qty, product.stock, 20) }]
    })

  const setQty = (id, qty) =>
    setItems((cur) =>
      cur.map((i) => (i.product.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.product.stock, 20)) } : i))
    )
  const remove = (id) => setItems((cur) => cur.filter((i) => i.product.id !== id))
  const clear = () => setItems([])

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
