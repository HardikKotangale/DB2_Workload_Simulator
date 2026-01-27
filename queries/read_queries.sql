-- R1: Orders by customer (recent first)
SELECT o.order_id, o.order_ts, o.status, o.total
FROM orders o
WHERE o.customer_id = ?
ORDER BY o.order_ts DESC
FETCH FIRST 20 ROWS ONLY;

-- R2: Revenue by city (aggregation)
SELECT c.city, DECIMAL(SUM(o.total), 12, 2) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status IN ('PAID','NEW')
GROUP BY c.city
ORDER BY revenue DESC;

-- R3: Top products by quantity
SELECT p.category, p.name, SUM(oi.quantity) AS qty
FROM order_items oi
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category, p.name
ORDER BY qty DESC
FETCH FIRST 10 ROWS ONLY;

-- R4: Find customers created recently (time filter)
SELECT customer_id, full_name, city, created_at
FROM customers
WHERE created_at >= (CURRENT TIMESTAMP - 7 DAYS)
ORDER BY created_at DESC;

-- R5: Average order total by status
SELECT status, DECIMAL(AVG(total), 12, 2) AS avg_total
FROM orders
GROUP BY status
ORDER BY avg_total DESC;
