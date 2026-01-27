-- W1: Insert a new customer
INSERT INTO customers(full_name, email, city) VALUES (?, ?, ?);

-- W2: Insert a new order
INSERT INTO orders(customer_id, status, total) VALUES (?, ?, ?);

-- W3: Insert order item
INSERT INTO order_items(order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?);

-- W4: Update order status
UPDATE orders SET status = ? WHERE order_id = ?;

-- W5: Audit log
INSERT INTO audit_log(event_type, detail) VALUES (?, ?);
