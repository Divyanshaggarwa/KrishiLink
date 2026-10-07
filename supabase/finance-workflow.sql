-- Run once in the Supabase SQL Editor before deploying the finance workflow.
-- Existing transactions.transporter_id references profiles(id); KrishiLink's
-- admin profile is used as the transporter account for platform-arranged trips.

alter table public.transactions
  add column if not exists transporter_fee_total numeric(12, 2),
  add column if not exists transporter_payout_total numeric(12, 2),
  add column if not exists platform_fee_total numeric(12, 2);

insert into public.fee_config (key, value, unit, description)
select
  'farmer_fee_pct',
  coalesce(
    (select value from public.fee_config where key = 'commission_pct' limit 1),
    2.0
  ),
  '%',
  'Platform fee deducted from farmer proceeds when an order completes'
where not exists (
  select 1 from public.fee_config where key = 'farmer_fee_pct'
);

insert into public.fee_config (key, value, unit, description)
select
  'buyer_fee_pct',
  1.0,
  '%',
  'Platform fee added to buyer settlement when an order completes'
where not exists (
  select 1 from public.fee_config where key = 'buyer_fee_pct'
);

insert into public.fee_config (key, value, unit, description)
select
  'transporter_fee_pct',
  5.0,
  '%',
  'Platform fee deducted from KrishiLink-arranged transport payout'
where not exists (
  select 1 from public.fee_config where key = 'transporter_fee_pct'
);

insert into public.fee_config (key, value, unit, description)
select
  'handling_per_kg',
  0.2,
  '₹/kg',
  'Handling deduction from farmer proceeds on completed orders'
where not exists (
  select 1 from public.fee_config where key = 'handling_per_kg'
);
