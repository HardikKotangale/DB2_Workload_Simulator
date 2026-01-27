INSERT INTO orders(customer_id, status, total) VALUES
  (1, 'PAID', -42.00);

INSERT INTO orders(customer_id, status, total) VALUES
  (2, 'NEW', 19.99);

INSERT INTO audit_log(event_type, detail)
VALUES ('DEFECT', 'Injected defects: negative total order and order-without-items.');
