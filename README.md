# Duka Hub

An online shop built with React (Vite), Node.js + Express and Supabase.

Features: product catalog with search and categories, product gallery, cart, checkout, order history,
Google sign-in (Supabase Auth), M-Pesa payment prompt (Safaricom Daraja), pay on delivery,
and order confirmation emails (Mailgun).

## Run locally
1. `cd backend`, create `.env` (see below), run `npm install` then `npm start`
2. `cd frontend`, create `.env`, run `npm install` then `npm run dev`

Backend `.env`: SUPABASE_URL, SUPABASE_SERVICE_KEY, PORT, MPESA_*, MAILGUN_*, MAIL_FROM
Frontend `.env`: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

Built with AI assistance (Claude).
