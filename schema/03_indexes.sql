-- Indexes commonly helpful for workload queries
CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_orders_customer_ts ON orders(customer_id, order_ts);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_products_category ON products(category);
