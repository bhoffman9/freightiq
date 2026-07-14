-- Atomic AP payment record/undo. Replaces the old two-step (insert payment, then
-- separately update invoice) which could race or half-fail and leave
-- payments vs invoices.amount_paid diverged. Each function is a single
-- transaction that locks the invoice row (FOR UPDATE), writes the payment, and
-- recomputes amount_paid + status with the ±$0.05 tolerance.

create or replace function ap_record_payment(
  p_invoice_id uuid, p_amount numeric, p_date date, p_method text, p_note text
) returns jsonb language plpgsql security definer as $$
declare v_amount numeric; v_paid numeric; v_new_paid numeric; v_status text; v_pmt_id uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select amount, amount_paid into v_amount, v_paid from invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  insert into payments(invoice_id, amount, payment_date, payment_method, note)
    values (p_invoice_id, p_amount, coalesce(p_date, current_date), coalesce(nullif(p_method,''), 'ACH'), p_note)
    returning id into v_pmt_id;
  v_new_paid := coalesce(v_paid, 0) + p_amount;
  v_status := case when v_new_paid >= v_amount - 0.05 then 'paid' else 'partial' end;
  update invoices set amount_paid = v_new_paid, status = v_status where id = p_invoice_id;
  return jsonb_build_object('ok', true, 'paymentId', v_pmt_id, 'newPaid', round(v_new_paid, 2), 'status', v_status);
end $$;

create or replace function ap_undo_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_inv uuid; v_pmt numeric; v_amount numeric; v_paid numeric; v_new_paid numeric; v_status text;
begin
  select invoice_id, amount into v_inv, v_pmt from payments where id = p_payment_id;
  if not found then raise exception 'payment not found'; end if;
  select amount, amount_paid into v_amount, v_paid from invoices where id = v_inv for update;
  delete from payments where id = p_payment_id;
  v_new_paid := greatest(0, coalesce(v_paid, 0) - v_pmt);
  v_status := case when v_new_paid <= 0.05 then 'open'
                   when v_new_paid >= v_amount - 0.05 then 'paid'
                   else 'partial' end;
  update invoices set amount_paid = v_new_paid, status = v_status where id = v_inv;
  return jsonb_build_object('ok', true, 'newPaid', round(v_new_paid, 2), 'status', v_status);
end $$;
