-- Database Schema for East African Spirit (T) Ltd

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Database: `sales_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('admin','accountant','sales_officer') NOT NULL DEFAULT 'sales_officer',
  `signature_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`username`, `password`, `full_name`, `role`, `signature_path`) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'admin', NULL), -- password: password
('richard', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Richard Mugisha', 'sales_officer', NULL),
('accountant1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane Doe', 'accountant', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `location` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `is_export` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `name`, `location`, `phone`) VALUES
(1, 'EMANUEL CHONJO', 'DODOMA', '0764 935 115'),
(2, 'JAPHET MASUKE', 'SHINYANGA', '0754 764 968'),
(3, 'MINJA SEVERINI', 'SHINYANGA', '0658 828 432'),
(4, 'BOZRA NDETI', 'SHINYANGA', '0755 716 520'),
(5, 'B. S LIQUORS STORE', 'SHINYANGA', '0756 716 520'),
(6, 'DOHAKI LTD', 'ARUSHA', ''),
(7, 'JOJONO ENTERPRISES', 'DAR ES SALAAM', '0713 242 229'),
(8, 'B. P. K COMPANY', 'DAR ES SALAAM', ''),
(9, 'S.D VASANT', 'TANGA MJINI', '0713 437 537'),
(10, 'ALEX GERVAS NDABATINYA', 'MPANDA- KATAVI', '0765 504 290'),
(11, 'YUDA MAKINDA', 'MPANDA- KATAVI', '0753 353 523'),
(12, 'ALEX JOHN MILINGA/NGUSA SHOP', 'MPANDA- KATAVI', '0753 984 542'),
(13, 'JOEL MVANGA', 'MASWA & MEATU', '0758 004 083'),
(14, 'GRAMBA STORE', 'MWANZA', '0784 800 744'),
(15, 'STELLA KIZIGA', 'KIJITONYAMA BRANCH-DAR', ''),
(16, 'TAKAWEDO', 'DODOMA', ''), -- Note: 16 in list
(17, 'JULIO', 'SUMBAWANGA', '0762 147 046'),
(18, 'MAMA GOOD', 'SUMBAWANGA', '0762 465 804'),
(19, 'KURWA SHOP', 'MPANDA', '0755 572 605'),
(20, 'OBAMA', 'DODOMA', '0755 897 355'),
(21, 'OBAMA', 'MBEYA', '0786 670 754'),
(22, 'MARWA PATRICK', 'MBEYA', ''),
(23, 'SIMON GWERA', 'MUSOMA/SERENGETI', ''),
(24, 'MAMA NKAMBA', 'BARIADI', ''),
(25, 'SULUBA', 'DUTWA', ''),
(26, 'SHULI', 'MASWA', ''),
(27, 'MACHA', 'MWANHUZI', ''),
(28, 'KABAGO', 'BUKOBA', ''),
(29, 'MARK AUGUSTIN MMASSY', 'MOROGORO', ''),
(30, 'MAWIBO BEVERAGE', 'MBEYA', ''),
(31, 'SAIYE MINJA', '', ''),
(32, 'LEGO STORE', 'SHINYANGA', ''),
(33, 'FREDRICK S MLELWA', 'MWANZA', ''),
(34, 'EMANUEL JOEL MTOKOMA', 'MAFINGA', ''),
(35, 'ESTAM AFRICA ENTERPRISES', 'DODOMA', ''),
(36, 'KILEMA INVESTMENT', 'MOROGORO', ''),
(37, 'SWEET TEST', 'IRINGA', ''),
(38, 'MARK A MMASSY', 'IFAKARA', ''),
(39, 'LUCAS URIO', 'DAR ES SALAAM', ''),
(40, 'WAKARA', 'MUSOMA', ''),
(41, 'LUSTE', 'MOSHI', ''),
(42, 'JANGALA', 'NZEGA', ''),
(43, 'LEONARD MUSHI', '', ''),
(44, 'MANKA INFINITY', 'BABATI', ''),
(45, 'RICHARD MUGISHA', 'SHINYANGA', ''),
(46, 'KALIWABHO BEVERAGES', 'KAHAMA', ''),
(47, 'ZAKARIA KISUMO', 'TABORA', '0625 626 006'),
(48, 'PAUL WILLIAM KANSIGO', 'KAHAMA', ''),
(49, 'NTINDOGO NZIKU J MZULINGI', 'KAHAMA', ''),
(50, 'UMULIZA', 'BUKOBA', ''),
(51, 'RICHARD MUGISHA', '', '');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `default_price` decimal(10,2) DEFAULT 0.00,
  `carton_weight` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `products`
--

-- Note: All prices are VAT EXCLUSIVE (net prices)
-- VAT (18%) will be added on top for local customers
INSERT INTO `products` (`id`, `name`, `default_price`) VALUES
(1, 'D-PET', 42372.88),
(2, 'D GLASS', 0.00),
(3, 'H - 200ml', 72033.90),
(4, 'H 500ml', 0.00),
(5, 'H-750ml', 86440.68),
(6, 'GOLDBERG PREMIUM LAGER', 25495.55),
(7, 'MBOGO BANANA WINE BOX', 13789.99);

-- --------------------------------------------------------

--
-- Table structure for table `customer_prices`
--

CREATE TABLE `customer_prices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_price` (`customer_id`, `product_id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `customer_prices`
--

-- Note: All customer prices are VAT EXCLUSIVE (net prices)
INSERT INTO `customer_prices` (`customer_id`, `product_id`, `price`) VALUES
-- 1. EMANUEL CHONJO (51000/1.18=43220.34, 85000/1.18=72033.90, 102000/1.18=86440.68)
(1, 1, 43220.34), (1, 3, 72033.90), (1, 5, 86440.68),
-- 3. MINJA SEVERINI (51500/1.18=43644.07)
(3, 1, 43644.07), (3, 3, 72033.90), (3, 5, 86440.68),
-- 5. B. S LIQUORS STORE (50000/1.18=42372.88)
(5, 1, 42372.88), (5, 3, 72033.90), (5, 5, 86440.68),
-- 6. DOHAKI LTD
(6, 1, 42372.88), (6, 3, 72033.90), (6, 5, 86440.68),
-- 7. JOJONO ENTERPRISES (84500/1.18=71610.17, 101500/1.18=86016.95)
(7, 1, 42372.88), (7, 3, 71610.17), (7, 5, 86016.95),
-- 8. B. P. K COMPANY
(8, 3, 72033.90), (8, 5, 86440.68),
-- 9. S.D VASANT
(9, 3, 72033.90), (9, 5, 86440.68),
-- 10. ALEX GERVAS NDABATINYA (52000/1.18=44067.80)
(10, 1, 44067.80),
-- 11. YUDA MAKINDA
(11, 1, 44067.80), (11, 3, 72033.90), (11, 5, 86440.68),
-- 12. ALEX JOHN MILINGA/NGUSA SHOP
(12, 1, 44067.80), (12, 3, 72033.90), (12, 5, 86440.68),
-- 13. JOEL MVANGA (50500/1.18=42796.61)
(13, 1, 42796.61), (13, 3, 72033.90), (13, 5, 86440.68),
-- 14. GRAMBA STORE
(14, 3, 71610.17), (14, 5, 86016.95),
-- 15. STELLA KIZIGA
(15, 1, 42372.88),
-- 16. TAKAWEDO
(16, 3, 72033.90), (16, 5, 86440.68),
-- 28. KABAGO
(28, 3, 72033.90), (28, 5, 86440.68),
-- 31. SAIYE MINJA
(31, 1, 43644.07),
-- 32. LEGO STORE
(32, 1, 43644.07),
-- 33. FREDRICK S MLELWA
(33, 1, 43220.34), (33, 3, 72033.90), (33, 5, 86440.68),
-- 34. EMANUEL JOEL MTOKOMA (86000/1.18=72881.36, 103000/1.18=87288.14)
(34, 1, 44067.80), (34, 3, 72881.36), (34, 5, 87288.14),
-- 35. ESTAM AFRICA ENTERPRISES
(35, 1, 43220.34), (35, 3, 71610.17), (35, 5, 86016.95),
-- 36. KILEMA INVESTMENT
(36, 3, 72033.90), (36, 5, 86440.68),
-- 37. SWEET TEST
(37, 1, 43220.34), (37, 3, 72033.90),
-- 38. MARK A MMASSY
(38, 3, 72033.90),
-- 39. LUCAS URIO
(39, 3, 72033.90), (39, 5, 86440.68),
-- 41. LUSTE
(41, 1, 42372.88), (41, 3, 72033.90), (41, 5, 86440.68),
-- 43. LEONARD MUSHI
(43, 1, 42372.88), (43, 3, 71610.17), (43, 5, 86016.95),
-- 44. MANKA INFINITY
(44, 3, 72033.90), (44, 5, 86440.68),
-- 45. RICHARD MUGISHA (87000/1.18=73728.81, 104000/1.18=88135.59)
(45, 3, 73728.81), (45, 5, 88135.59),
-- 50. UMULIZA
(50, 3, 72033.90), (50, 5, 86440.68);

-- --------------------------------------------------------

--
-- Table structure for table `requests`
--

CREATE TABLE `requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `truck_no` varchar(20) DEFAULT NULL,
  `driver_name` varchar(100) DEFAULT NULL,
  `route` varchar(100) DEFAULT NULL,
  `request_date` date NOT NULL,
  `status` enum('pending','approved','dispatched','rejected') NOT NULL DEFAULT 'pending',
  `vat_percent` decimal(5,2) DEFAULT 18.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `request_items`
--

CREATE TABLE `request_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `request_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`request_id`) REFERENCES `requests` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `request_signatures`
--

CREATE TABLE `request_signatures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `request_id` int(11) NOT NULL,
  `signer_id` int(11) NOT NULL,
  `signature_type` enum('prepared_by','requested_by','authorised_by','approved_by') NOT NULL,
  `signed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`request_id`) REFERENCES `requests` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`signer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;
