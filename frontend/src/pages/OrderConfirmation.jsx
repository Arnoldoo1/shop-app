import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as api from '../api'
import { money } from '../CartContext'

export default function OrderConfirmation() {
  const location = useLocation()
  const [order] = useState(() => {
    let o = location.state && location.state.order
    if (!o) {
      try { o = JSON.parse(sessionStorage.getItem('lastOrder')) } catch { o = null }
    }
    return o
  })
  const [status, setStatus] = useState(order ? order.payment_status : 'pending')
  const [phase, setPhase] = useState('idle')
  const [message, setMessage] = useState('')
  const [payPhone, setPayPhone] = useState(order ? order.phone : '')
  const [sandbox, setSandbox] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    api.getConfig().then((c) => setSandbox(c.mpesa_env !== 'production')).catch(() => {})
    return () => clearInterval(timer.current)
  }, [])

  if (!order) {
    return <p className="empty">No recent order found. <Link to="/">Back to shop</Link></p>
  }

  const isMpesa = order.payment_method === 'mpesa'

  function startPolling() {
    let tries = 0
    clearInterval(timer.current)
    timer.current = setInterval(async () => {
      tries += 1
      try {
        const r = await api.getPaymentStatus(order.id)
        if (r.status === 'paid' || r.status === 'failed') {
          clearInterval(timer.current)
          setStatus(r.status)
          setPhase('idle')
          setMessage(r.status === 'failed' ? (r.message || 'Payment was not completed.') : '')
          return
        }
      } catch { /* keep trying */ }
      if (tries >= 30) {
        clearInterval(timer.current)
        setPhase('idle')
        setMessage('No confirmation yet. Press the button to try again.')
      }
    }, 4000)
  }

  async function pay() {
    setPhase('sending')
    setMessage('')
    try {
      await api.payMpesa(order.id, payPhone)
      setPhase('waiting')
      setMessage('Check your phone and enter your M-Pesa PIN.')
      startPolling()
    } catch (e) {
      setPhase('idle')
      setMessage(e.message)
    }
  }

  async function simulate() {
    try {
      await api.sandboxConfirm(order.id)
      clearInterval(timer.current)
      setStatus('paid')
      setPhase('idle')
      setMessage('')
    } catch (e) {
      setMessage(e.message)
    }
  }

  const ref = '#' + order.id.slice(0, 8).toUpperCase()

  return (
    <div className="confirm">
      <div className="tick">&#10003;</div>
      <h1>Thank you, {order.customer_name.split(' ')[0]}!</h1>
      <p className="muted">Your order has been placed. A confirmation email is on its way.</p>

      {isMpesa && status !== 'paid' && (
        <div className="panel pay-box">
          <h2>Complete your payment</h2>
          <p className="muted">We will send a payment prompt for {money(order.total)} to this M-Pesa number:</p>
          <input className="pay-phone" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} placeholder="0712345678" />
          <button className="btn primary" onClick={pay} disabled={phase !== 'idle'}>
            {phase === 'sending' ? 'Sending prompt...' : phase === 'waiting' ? 'Waiting for payment...' : status === 'failed' ? 'Try again' : 'Send M-Pesa prompt'}
          </button>
          {message && <p className={status === 'failed' ? 'err' : 'muted'}>{message}</p>}
          {sandbox && (
            <div className="sandbox">
              <p className="muted">Test mode: Safaricom's sandbox does not send prompts to real phones.</p>
              <button className="btn small" onClick={simulate}>Simulate successful payment (test mode)</button>
            </div>
          )}
        </div>
      )}
      {isMpesa && status === 'paid' && <div className="panel pay-box paid">Payment received. Thank you!</div>}
      {!isMpesa && <div className="panel pay-box">Pay {money(order.total)} in cash when your order is delivered.</div>}

      <div className="panel">
        <div className="line"><span>Order number</span><strong>{ref}</strong></div>
        <div className="line"><span>Payment</span><span>{isMpesa ? 'M-Pesa' : 'Pay on delivery'}</span></div>
        <div className="line"><span>Payment status</span><span className="pill">{status}</span></div>
        <div className="line"><span>Deliver to</span><span>{order.address}, {order.city}</span></div>
        <h2>Items</h2>
        {order.items.map((i, idx) => (
          <div key={idx} className="line"><span>{i.name} x {i.quantity}</span><span>{money(i.price * i.quantity)}</span></div>
        ))}
        <div className="line sep"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        <div className="line"><span>Delivery</span><span>{order.delivery_fee === 0 ? 'Free' : money(order.delivery_fee)}</span></div>
        <div className="line total"><span>Total</span><span>{money(order.total)}</span></div>
      </div>
      <Link to="/" className="btn primary">Continue shopping</Link>
    </div>
  )
}
