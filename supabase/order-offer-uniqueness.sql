-- Run once in the Supabase SQL Editor to prevent duplicate orders for an offer.
-- Resolve any duplicate offer_id groups before applying this constraint.

do $$
declare
  duplicate_orders text;
begin
  select string_agg(
    format('offer %s has transactions [%s]', offer_id, transaction_ids),
    '; '
  )
  into duplicate_orders
  from (
    select
      offer_id,
      string_agg(id::text, ', ' order by created_at) as transaction_ids
    from public.transactions
    where offer_id is not null
    group by offer_id
    having count(*) > 1
  ) duplicates;

  if duplicate_orders is not null then
    raise exception
      'Resolve duplicate orders and reconcile wallet entries before applying this index: %',
      duplicate_orders;
  end if;
end
$$;

create unique index if not exists transactions_offer_id_unique
  on public.transactions (offer_id)
  where offer_id is not null;
