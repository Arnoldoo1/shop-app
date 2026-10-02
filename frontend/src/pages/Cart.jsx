import { Link } from 'react-router-dom'
import { FREE_DELIVERY_OVER, money, useCart } from '../CartContext'

export default function Cart() {
  const { items, setQty, remove, subtotal, delivery, total } = useCart()

  if (items.length === 0) {
    return <p className="empty">Your cart is empty. <Link to="/">Start shopping</Link></p>
  }

  return (
    <div className="cart-page">
      <h1>Your cart</h1>
      <div className="cart-layout">
        <div>
          {items.map(({ product, quantity }) => (
            <div key={product.id} className="cart-row">
              <img src={product.image_url} alt={product.name} />
              <div className="grow">
                <Link to={`/product/${product.slug}`} className="card-title">{product.name}</Link>
                <div className="muted">{money(product.price)} each</div>
                <div className="qty small">
                  <button onClick={() => setQty(product.id, quantity - 1)}>-</button>
                  <span>{quantity}</span>
                  <button onClick={() => setQty(product.id, quantity + 1)}>+</button>
                </div>
              </div>
              <div className="right">
                <strong>{money(product.price * quantity)}</strong>
                <button className="link-btn" onClick={() => remove(product.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <aside className="summary">
          <h2>Order summary</h2>
          <div className="line"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="line"><span>Delivery</span><span>{delivery === 0 ? 'Free' : money(delivery)}</span></div>
          {delivery > 0 && (
            <p className="muted">Add {money(FREE_DELIVERY_OVER - subtotal)} more for free delivery.</p>
          )}
          <div className="line total"><span>Total</span><span>{money(total)}</span></div>
          <Link to="/checkout" className="btn primary block">Proceed to checkout</Link>
        </aside>
      </div>
    </div>
  )
}
