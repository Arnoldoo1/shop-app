import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../AuthContext'
import { money } from '../CartContext'

export default function MyOrders() {
  const { user, loading: authLoading, signIn } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    api.getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [user, authLoading])

  if (authLoading || loading) return <p className="empty">Loading...</p>
  if (!user) {
    return (
      <div className="empty">
        <p>Sign in to see your orders.</p>
        <button className="btn primary" onClick={signIn}>Sign in with Google</button>
      </div>
    )
  }

  return (
    <div className="cart-page">
      <h1>My orders</h1>
      {error && <div className="banner">{error}</div>}
      {orders.length === 0 ? (
        <p className="empty">No orders yet. <Link to="/">Start shopping</Link></p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="panel">
            <div className="line">
              <strong>#{o.id.slice(0, 8).toUpperCase()}</strong>
              <span className="muted">{new Date(o.created_at).toLocaleDateString()}</span>
            </div>
            <div className="line">
              <span className="pill">{o.order_status}</span>
              <span className="pill">Payment: {o.payment_status}</span>
            </div>
            {o.order_items.map((i) => (
              <div key={i.id} className="line"><span>{i.name} x {i.quantity}</span><span>{money(i.price * i.quantity)}</span></div>
            ))}
            <div className="line total"><span>Total</span><span>{money(o.total)}</span></div>
          </div>
        ))
      )}
    </div>
  )
}
