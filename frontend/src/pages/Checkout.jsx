import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'
import { money, useCart } from '../CartContext'
import { useAuth } from '../AuthContext'

const METHODS = [
  { id: 'mpesa', label: 'M-Pesa', hint: 'A payment prompt is sent to your phone after you place the order' },
  { id: 'cod', label: 'Pay on delivery', hint: 'Pay cash when your order arrives' },
]

function validate(f) {
  const e = {}
  if (f.customer_name.trim().length < 2) e.customer_name = 'Please enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Please enter a valid email address.'
  if (!/^\+?\d{9,15}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Please enter a valid phone number, e.g. 0712345678.'
  if (f.address.trim().length < 3) e.address = 'Please enter your delivery address.'
  if (f.city.trim().length < 2) e.city = 'Please enter your town or city.'
  return e
}

export default function Checkout() {
  const { items, subtotal, delivery, total, clear } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [method, setMethod] = useState('mpesa')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  if (items.length === 0) {
    return <p className="empty">Your cart is empty. <Link to="/">Start shopping</Link></p>
  }

  async function submit(e) {
    e.preventDefault()
    const raw = Object.fromEntries(new FormData(e.currentTarget))
    const form = {
      customer_name: String(raw.customer_name || ''),
      email: String(raw.email || ''),
      phone: String(raw.phone || ''),
      address: String(raw.address || ''),
      city: String(raw.city || ''),
      notes: String(raw.notes || ''),
      payment_method: method,
    }
    const found = validate(form)
    setErrors(found)
    setServerError('')
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const order = await api.createOrder({
        ...form,
        items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      })
      try { sessionStorage.setItem('lastOrder', JSON.stringify(order)) } catch { /* ignore */ }
      navigate('/order-confirmation', { state: { order } })
      clear()
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const field = (key, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input name={key} {...props} />
      {errors[key] && <small className="err">{errors[key]}</small>}
    </label>
  )

  return (
    <div className="cart-page">
      <h1>Checkout</h1>
      <form className="cart-layout" onSubmit={submit} noValidate>
        <div>
          <section className="panel">
            <h2>Delivery details</h2>
            {field('customer_name', 'Full name', {
              autoComplete: 'name', placeholder: 'e.g. Jane Wanjiku',
              defaultValue: (user && user.user_metadata && user.user_metadata.full_name) || '',
            })}
            <div className="two">
              {field('email', 'Email', { type: 'email', autoComplete: 'email', defaultValue: (user && user.email) || '' })}
              {field('phone', 'Phone number (M-Pesa)', { type: 'tel', autoComplete: 'tel', placeholder: '0712345678' })}
            </div>
            {field('address', 'Delivery address', { autoComplete: 'street-address', placeholder: 'Street, building, house number' })}
            {field('city', 'Town or city', { autoComplete: 'address-level2' })}
            <label className="field">
              <span>Order notes (optional)</span>
              <textarea name="notes" rows="3" placeholder="Landmarks, delivery instructions..." />
            </label>
          </section>

          <section className="panel">
            <h2>Payment method</h2>
            {METHODS.map((m) => (
              <label key={m.id} className={method === m.id ? 'method selected' : 'method'}>
                <input type="radio" name="payment" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />
                <div>
                  <strong>{m.label}</strong>
                  <div className="muted">{m.hint}</div>
                </div>
              </label>
            ))}
          </section>
        </div>

        <aside className="summary">
          <h2>Order summary</h2>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="line">
              <span>{product.name} x {quantity}</span>
              <span>{money(product.price * quantity)}</span>
            </div>
          ))}
          <div className="line sep"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="line"><span>Delivery</span><span>{delivery === 0 ? 'Free' : money(delivery)}</span></div>
          <div className="line total"><span>Total</span><span>{money(total)}</span></div>
          {serverError && <div className="banner">{serverError}</div>}
          <button className="btn primary block" type="submit" disabled={submitting}>
            {submitting ? 'Placing order...' : `Place order - ${money(total)}`}
          </button>
          <Link to="/cart" className="muted center">Back to cart</Link>
        </aside>
      </form>
    </div>
  )
}
