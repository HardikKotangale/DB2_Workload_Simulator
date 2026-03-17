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

-- T4: No zero-total orders (orders must have a meaningful amount)
SELECT COUNT(*) AS zero_total_orders
FROM orders
WHERE total = 0;

-- T5: All products must have a positive price
SELECT COUNT(*) AS invalid_product_prices
FROM products
WHERE price <= 0;

-- T6: No orphaned order items (items referencing non-existent orders)
SELECT COUNT(*) AS orphaned_items
FROM order_items oi
LEFT JOIN orders o ON o.order_id = oi.order_id
WHERE o.order_id IS NULL;

-- T7: All order items must have positive quantity and unit price
SELECT COUNT(*) AS invalid_order_items
FROM order_items
WHERE quantity <= 0 OR unit_price <= 0;
