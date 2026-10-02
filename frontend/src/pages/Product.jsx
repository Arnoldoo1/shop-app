import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'
import { money, useCart } from '../CartContext'

export default function Product() {
  const { slug } = useParams()
  const { add } = useCart()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getProduct(slug).then(setProduct).catch((e) => setError(e.message))
  }, [slug])

  if (error) return <p className="empty">{error} <Link to="/">Back to shop</Link></p>
  if (!product) return <p className="empty">Loading...</p>

  return (
    <div className="detail">
      <img src={product.image_url} alt={product.name} />
      <div>
        <Link to="/" className="back">&larr; Back to shop</Link>
        <span className="tag">{product.category}</span>
        <h1>{product.name}</h1>
        <div className="price big">{money(product.price)}</div>
        <p className="desc">{product.description}</p>
        <div className={product.stock === 0 ? 'stock out' : product.stock < 10 ? 'stock low' : 'stock'}>
          {product.stock === 0 ? 'Out of stock' : product.stock < 10 ? `Only ${product.stock} left` : 'In stock'}
        </div>
        {product.stock > 0 && (
          <div className="row">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock, 20, qty + 1))}>+</button>
            </div>
            <button className="btn primary" onClick={() => { add(product, qty); navigate('/cart') }}>
              Add to cart
            </button>
          </div>
        )}
        <ul className="perks">
          <li>Free delivery on orders over KES 5,000</li>
          <li>Pay with M-Pesa or on delivery</li>
        </ul>
      </div>
    </div>
  )
}
