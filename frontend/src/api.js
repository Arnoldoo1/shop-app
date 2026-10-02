import { supabase } from './supabase'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'

async function getToken() {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session ? data.session.access_token : null
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const { headers, ...rest } = options
  const token = await getToken()
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    })
  } catch {
    throw new Error('Cannot reach the shop server. Please make sure the backend is running.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status}).`)
  }
  return res.json()
}

export const getConfig = () => request('/api/config')
export const getProducts = (params = {}) => request('/api/products?' + new URLSearchParams(params))
export const getCategories = () => request('/api/categories')
export const getProduct = (slug) => request(`/api/products/${slug}`)
export const createOrder = (body) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) })
export const getMyOrders = () => request('/api/orders/mine')
export const payMpesa = (id, phone) =>
  request(`/api/orders/${id}/mpesa`, { method: 'POST', body: JSON.stringify({ phone }) })
export const getPaymentStatus = (id) => request(`/api/orders/${id}/payment-status`)
export const sandboxConfirm = (id) => request(`/api/orders/${id}/sandbox-confirm`, { method: 'POST' })
