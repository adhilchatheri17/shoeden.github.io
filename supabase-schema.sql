create table if not exists public.orders (
  id text primary key,
  date timestamptz not null default now(),
  agent_name text not null,
  customer_name text,
  customer_phone text,
  delivery_area text,
  godown_location text not null,
  whatsapp_group text,
  status text not null default 'New'
    check (status in ('New', 'Packed', 'Dispatched', 'Delivered')),
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "Logged in users can read orders" on public.orders;
create policy "Logged in users can read orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "Logged in users can create orders" on public.orders;
create policy "Logged in users can create orders"
on public.orders
for insert
to authenticated
with check (true);

drop policy if exists "Logged in users can update orders" on public.orders;
create policy "Logged in users can update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Logged in users can delete orders" on public.orders;
create policy "Logged in users can delete orders"
on public.orders
for delete
to authenticated
using (true);
