-- =====================================================
-- UPDATE PRICES TO VAT EXCLUSIVE
-- =====================================================
-- Run this script to convert existing prices from VAT Inclusive to VAT Exclusive
-- Formula: VAT Exclusive Price = VAT Inclusive Price / 1.18
-- Date: 2025-12-20
-- =====================================================

-- Start Transaction
START TRANSACTION;

-- =====================================================
-- UPDATE PRODUCT DEFAULT PRICES
-- =====================================================
UPDATE `products` SET `default_price` = ROUND(`default_price` / 1.18, 2) WHERE `default_price` > 0;

-- Verification (uncomment to check)
-- SELECT id, name, default_price FROM products;

-- =====================================================
-- UPDATE CUSTOMER-SPECIFIC PRICES
-- =====================================================
UPDATE `customer_prices` SET `price` = ROUND(`price` / 1.18, 2);

-- Verification (uncomment to check)
-- SELECT cp.id, c.name as customer, p.name as product, cp.price 
-- FROM customer_prices cp 
-- JOIN customers c ON cp.customer_id = c.id 
-- JOIN products p ON cp.product_id = p.id
-- ORDER BY c.name, p.name;

-- =====================================================
-- COMMIT CHANGES
-- =====================================================
COMMIT;

-- =====================================================
-- VERIFICATION QUERY - Run after commit to verify
-- =====================================================
SELECT 
    p.name as Product,
    p.default_price as 'Default Price (Ex VAT)',
    ROUND(p.default_price * 1.18, 2) as 'Price with VAT (18%)'
FROM products p
WHERE p.default_price > 0
ORDER BY p.name;

-- Show sample customer prices
SELECT 
    c.name as Customer,
    p.name as Product,
    cp.price as 'Price (Ex VAT)',
    ROUND(cp.price * 1.18, 2) as 'Price with VAT (18%)'
FROM customer_prices cp
JOIN customers c ON cp.customer_id = c.id
JOIN products p ON cp.product_id = p.id
ORDER BY c.name, p.name
LIMIT 20;
