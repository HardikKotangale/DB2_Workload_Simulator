-- T1: No negative totals
SELECT COUNT(*) AS bad_orders
FROM orders
WHERE total < 0;

-- T2: Every order has at least 1 item
SELECT COUNT(*) AS orders_without_items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.order_id
WHERE oi.order_id IS NULL;

-- T3: Customer emails should be unique (basic integrity)
SELECT COUNT(*) AS duplicate_emails
FROM (
  SELECT email
  FROM customers
  GROUP BY email
  HAVING COUNT(*) > 1
) d;
