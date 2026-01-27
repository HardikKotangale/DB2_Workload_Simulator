UPDATE orders
SET total = 0.00
WHERE total < 0;

DELETE FROM orders
WHERE order_id IN (
  SELECT o.order_id
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.order_id
  WHERE oi.order_id IS NULL
);

ALTER TABLE orders
  ADD CONSTRAINT ck_orders_total_nonneg CHECK (total >= 0);

INSERT INTO audit_log(event_type, detail)
VALUES ('FIX', 'Patched negative totals, removed orders without items, and added CHECK constraint ck_orders_total_nonneg.');
