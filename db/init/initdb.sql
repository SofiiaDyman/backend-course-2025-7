CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    details TEXT,
    photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory (item_name, details, photo) VALUES
('Lenovo ThinkPad P1', 'Ноутбук для інженерних і аналітичних задач', NULL),
('Google Pixel 8', 'Смартфон для тестування Android-додатків', NULL),
('LG UltraWide Monitor', '34-дюймовий ультраширокий монітор для роботи з кодом', NULL)
ON CONFLICT DO NOTHING;
