-- Seed a small deterministic dataset for testing and development
INSERT INTO customers(full_name, email, city) VALUES
  ('Ava Johnson', 'ava.johnson@example.com', 'San Jose'),
  ('Liam Smith', 'liam.smith@example.com', 'San Francisco'),
  ('Noah Brown', 'noah.brown@example.com', 'Oakland'),
  ('Emma Davis', 'emma.davis@example.com', 'San Jose'),
  ('Olivia Wilson', 'olivia.wilson@example.com', 'Fremont');

INSERT INTO products(sku, name, category, price) VALUES
  ('SKU-100', 'Keyboard', 'Accessories', 49.99),
  ('SKU-101', 'Mouse', 'Accessories', 19.99),
  ('SKU-200', 'Monitor 24"', 'Displays', 149.99),
  ('SKU-201', 'Monitor 27"', 'Displays', 229.99),
  ('SKU-300', 'Laptop Stand', 'Accessories', 29.99),
  ('SKU-400', 'USB-C Dock', 'Accessories', 89.99);

-- Create a few orders
INSERT INTO orders(customer_id, status, total) VALUES
  (1, 'NEW', 69.98),
  (2, 'PAID', 149.99),
  (3, 'PAID', 249.98),
  (4, 'CANCELLED', 29.99);

INSERT INTO order_items(order_id, product_id, quantity, unit_price) VALUES
  (1, 1, 1, 49.99),
  (1, 2, 1, 19.99),
  (2, 3, 1, 149.99),
  (3, 3, 1, 149.99),
  (3, 2, 5, 19.99),
  (4, 5, 1, 29.99);

INSERT INTO audit_log(event_type, detail) VALUES
  ('SEED', 'Initial seed data inserted.');
