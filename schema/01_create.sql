CREATE TABLE customers (
  customer_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name   VARCHAR(120) NOT NULL,
  email       VARCHAR(180) NOT NULL,
  city        VARCHAR(80)  NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT TIMESTAMP
);

CREATE TABLE products (
  product_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku         VARCHAR(40) NOT NULL,
  name        VARCHAR(120) NOT NULL,
  category    VARCHAR(80) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT TIMESTAMP
);

CREATE TABLE orders (
  order_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  order_ts    TIMESTAMP NOT NULL DEFAULT CURRENT TIMESTAMP,
  status      VARCHAR(20) NOT NULL,
  total       DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE order_items (
  order_item_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id),
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE audit_log (
  log_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_ts   TIMESTAMP NOT NULL DEFAULT CURRENT TIMESTAMP,
  event_type VARCHAR(40) NOT NULL,
  detail     VARCHAR(500) NOT NULL
);
