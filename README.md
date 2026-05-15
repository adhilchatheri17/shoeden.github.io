# ShoeDen Operations

Static order-management app for ShoeDen, designed for GitHub Pages with Supabase Auth and Supabase Postgres storage.

## Supabase setup

1. Open Supabase SQL Editor.
2. Run `supabase-schema.sql`.
3. Create an Auth user:
   - Email: `admin@shoeden.com`
   - Password: `shoeden123`

The login screen keeps the simple local username `admin`; the app maps it to `admin@shoeden.com` before logging in with Supabase Auth.

The app stores:

- `orders`: agent/customer orders and delivery status.
- `godown_stocks`: editable stock quantity per godown, product, and color.

The Stock screen calculates dispatched-but-not-delivered hold quantity from orders with status `Dispatched`.

## GitHub Pages

Deploy the repository root from the `main` branch.

Main files:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-schema.sql`
- `assets/shoeden-logo.png`
