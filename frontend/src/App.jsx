import { Link, Route, Routes } from 'react-router-dom'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import Home from './pages/Home'
import Product from './pages/Product'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import OrderConfirmation from './pages/OrderConfirmation'
import MyOrders from './pages/MyOrders'

function App() {
  const { count } = useCart()
  const { user, signIn, signOut } = useAuth()
  const name = user && ((user.user_metadata && user.user_metadata.full_name) || user.email)

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="logo">Duka<span>Hub</span></Link>
          <nav className="nav-links">
            {user ? (
              <>
                <Link to="/orders">My orders</Link>
                <span className="muted hide-sm">{name}</span>
                <button className="link-btn plain" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <button className="btn small" onClick={signIn}>Sign in with Google</button>
            )}
            <Link to="/cart" className="cart-link">
              Cart <span className="cart-count">{count}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="*" element={<p className="empty">Page not found. <Link to="/">Back to shop</Link></p>} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">Duka Hub. Free delivery on orders over KES 5,000.</div>
      </footer>
    </>
  )
}

export default App
