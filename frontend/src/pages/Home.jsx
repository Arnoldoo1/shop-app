import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'
import { money, useCart } from '../CartContext'

export default function Home() {
  const { add } = useCart()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [added, setAdded] = useState('')

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      const params = {}
      if (category) params.category = category
      if (search.trim()) params.search = search.trim()
      api.getProducts(params)
        .then((d) => { setProducts(d); setError('') })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [category, search])

  function addToCart(p) {
    add(p, 1)
    setAdded(p.id)
    setTimeout(() => setAdded(''), 1200)
  }

  return (
    <>
      <section className="hero">
        <h1>Everything you need, delivered to your door</h1>
        <p>Quality products at fair prices. Pay easily with M-Pesa or on delivery.</p>
        <input
          type="search" placeholder="Search products..." value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <div className="chips">
        {['', ...categories].map((c) => (
          <button key={c || 'all'} className={category === c ? 'chip active' : 'chip'} onClick={() => setCategory(c)}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="banner">{error}</div>}
      {loading ? (
        <p className="empty">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="empty">No products found. Try another search or category.</p>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <article key={p.id} className="card">
              <Link to={`/product/${p.slug}`}>
                <img src={p.image_url} alt={p.name} loading="lazy" />
              </Link>
              <div className="card-body">
                <span className="tag">{p.category}</span>
                <Link to={`/product/${p.slug}`} className="card-title">{p.name}</Link>
                <div className="price">{money(p.price)}</div>
                <div className={p.stock === 0 ? 'stock out' : p.stock < 10 ? 'stock low' : 'stock'}>
                  {p.stock === 0 ? 'Out of stock' : p.stock < 10 ? `Only ${p.stock} left` : 'In stock'}
                </div>
                <button className="btn primary" disabled={p.stock === 0} onClick={() => addToCart(p)}>
                  {added === p.id ? 'Added!' : 'Add to cart'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
