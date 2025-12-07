-- =====================================================
-- CRM Zlecenia Montażowe v2.0 - Rozszerzony Schemat
-- Moduły: Klienci, Faktury, Oferty, Gmail
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- =====================================================
-- TABELA: clients - Baza klientów CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS `clients` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `type` ENUM('company', 'person') NOT NULL DEFAULT 'company',
    
    -- Dane firmy
    `company_name` VARCHAR(255) DEFAULT NULL,
    `nip` VARCHAR(20) DEFAULT NULL,
    `regon` VARCHAR(20) DEFAULT NULL,
    `krs` VARCHAR(20) DEFAULT NULL,
    
    -- Dane osobowe
    `first_name` VARCHAR(100) DEFAULT NULL,
    `last_name` VARCHAR(100) DEFAULT NULL,
    
    -- Kontakt
    `email` VARCHAR(255) DEFAULT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `phone2` VARCHAR(50) DEFAULT NULL,
    `website` VARCHAR(255) DEFAULT NULL,
    
    -- Adres
    `street` VARCHAR(255) DEFAULT NULL,
    `building_no` VARCHAR(20) DEFAULT NULL,
    `apartment_no` VARCHAR(20) DEFAULT NULL,
    `city` VARCHAR(100) DEFAULT NULL,
    `post_code` VARCHAR(10) DEFAULT NULL,
    `country` VARCHAR(50) DEFAULT 'Polska',
    
    -- Adres korespondencyjny (jeśli inny)
    `mail_street` VARCHAR(255) DEFAULT NULL,
    `mail_city` VARCHAR(100) DEFAULT NULL,
    `mail_post_code` VARCHAR(10) DEFAULT NULL,
    
    -- Dane do faktur
    `payment_method` ENUM('transfer', 'cash', 'card') DEFAULT 'transfer',
    `payment_days` INT(11) DEFAULT 7,
    `bank_account` VARCHAR(50) DEFAULT NULL,
    
    -- Integracje
    `infakt_id` INT(11) UNSIGNED DEFAULT NULL COMMENT 'ID klienta w inFakt',
    
    -- CRM
    `source` VARCHAR(100) DEFAULT NULL COMMENT 'Źródło pozyskania (Gmail, telefon, polecenie)',
    `tags` VARCHAR(500) DEFAULT NULL COMMENT 'Tagi oddzielone przecinkami',
    `notes` TEXT DEFAULT NULL,
    `rating` TINYINT(1) DEFAULT NULL COMMENT 'Ocena 1-5 gwiazdek',
    
    -- Metadane
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_by` INT(11) UNSIGNED DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_nip` (`nip`),
    KEY `idx_email` (`email`),
    KEY `idx_phone` (`phone`),
    KEY `idx_company_name` (`company_name`),
    KEY `idx_city` (`city`),
    KEY `idx_type` (`type`),
    FULLTEXT KEY `ft_search` (`company_name`, `first_name`, `last_name`, `email`, `phone`, `city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: client_contacts - Osoby kontaktowe w firmie
-- =====================================================
CREATE TABLE IF NOT EXISTS `client_contacts` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `client_id` INT(11) UNSIGNED NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) DEFAULT NULL,
    `position` VARCHAR(100) DEFAULT NULL COMMENT 'Stanowisko',
    `email` VARCHAR(255) DEFAULT NULL,
    `phone` VARCHAR(50) DEFAULT NULL,
    `is_primary` TINYINT(1) DEFAULT 0,
    `notes` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_client` (`client_id`),
    CONSTRAINT `fk_contacts_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: invoices - Faktury i proformy
-- =====================================================
CREATE TABLE IF NOT EXISTS `invoices` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INT(11) UNSIGNED DEFAULT NULL,
    `client_id` INT(11) UNSIGNED DEFAULT NULL,
    
    -- Typ dokumentu
    `type` ENUM('proforma', 'invoice', 'advance', 'correction') NOT NULL DEFAULT 'invoice',
    `number` VARCHAR(50) DEFAULT NULL COMMENT 'Numer faktury np. FV/2024/001',
    
    -- Integracja inFakt
    `infakt_id` INT(11) UNSIGNED DEFAULT NULL COMMENT 'ID faktury w inFakt',
    `infakt_number` VARCHAR(50) DEFAULT NULL,
    `infakt_link` VARCHAR(500) DEFAULT NULL COMMENT 'Link do faktury w inFakt',
    `pdf_path` VARCHAR(255) DEFAULT NULL,
    
    -- Kwoty
    `total_net` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total_vat` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total_gross` DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Płatności
    `payment_method` ENUM('transfer', 'cash', 'card', 'online') DEFAULT 'transfer',
    `payment_status` ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
    `paid_amount` DECIMAL(12,2) DEFAULT 0,
    `paid_date` DATE DEFAULT NULL,
    `due_date` DATE DEFAULT NULL,
    
    -- Daty
    `issue_date` DATE DEFAULT NULL,
    `sell_date` DATE DEFAULT NULL,
    
    -- Dodatkowe
    `description` TEXT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL,
    `sent_at` DATETIME DEFAULT NULL COMMENT 'Kiedy wysłano do klienta',
    `sent_to` VARCHAR(255) DEFAULT NULL COMMENT 'Email odbiorcy',
    
    -- Metadane
    `created_by` INT(11) UNSIGNED DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_number` (`number`),
    KEY `idx_job` (`job_id`),
    KEY `idx_client` (`client_id`),
    KEY `idx_type` (`type`),
    KEY `idx_status` (`payment_status`),
    KEY `idx_infakt` (`infakt_id`),
    CONSTRAINT `fk_invoices_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_invoices_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: invoice_items - Pozycje na fakturze
-- =====================================================
CREATE TABLE IF NOT EXISTS `invoice_items` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `invoice_id` INT(11) UNSIGNED NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `quantity` DECIMAL(10,3) NOT NULL DEFAULT 1,
    `unit` VARCHAR(20) DEFAULT 'szt.',
    `unit_price_net` DECIMAL(12,2) NOT NULL,
    `vat_rate` INT(3) NOT NULL DEFAULT 23,
    `total_net` DECIMAL(12,2) NOT NULL,
    `total_gross` DECIMAL(12,2) NOT NULL,
    `sort_order` INT(11) DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_invoice` (`invoice_id`),
    CONSTRAINT `fk_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: offers - Oferty/Wyceny
-- =====================================================
CREATE TABLE IF NOT EXISTS `offers` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `client_id` INT(11) UNSIGNED DEFAULT NULL,
    `job_id` INT(11) UNSIGNED DEFAULT NULL COMMENT 'Jeśli oferta przekształcona w zlecenie',
    
    -- Numer i status
    `offer_number` VARCHAR(50) NOT NULL,
    `status` ENUM('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
    `valid_until` DATE DEFAULT NULL,
    
    -- Kwoty
    `total_net` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total_vat` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `total_gross` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `discount_percent` DECIMAL(5,2) DEFAULT 0,
    `discount_amount` DECIMAL(12,2) DEFAULT 0,
    
    -- Treść
    `title` VARCHAR(255) DEFAULT NULL,
    `introduction` TEXT DEFAULT NULL COMMENT 'Tekst wstępny',
    `conclusion` TEXT DEFAULT NULL COMMENT 'Tekst końcowy',
    `notes` TEXT DEFAULT NULL COMMENT 'Uwagi wewnętrzne',
    
    -- Plik
    `pdf_path` VARCHAR(255) DEFAULT NULL,
    `pdf_generated_at` DATETIME DEFAULT NULL,
    
    -- Wysyłka
    `sent_at` DATETIME DEFAULT NULL,
    `sent_to` VARCHAR(255) DEFAULT NULL,
    `viewed_at` DATETIME DEFAULT NULL,
    `accepted_at` DATETIME DEFAULT NULL,
    `rejected_at` DATETIME DEFAULT NULL,
    `rejection_reason` TEXT DEFAULT NULL,
    
    -- Metadane
    `created_by` INT(11) UNSIGNED DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_offer_number` (`offer_number`),
    KEY `idx_client` (`client_id`),
    KEY `idx_job` (`job_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_offers_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_offers_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: offer_items - Pozycje w ofercie
-- =====================================================
CREATE TABLE IF NOT EXISTS `offer_items` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `offer_id` INT(11) UNSIGNED NOT NULL,
    `name` VARCHAR(500) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `quantity` DECIMAL(10,3) NOT NULL DEFAULT 1,
    `unit` VARCHAR(20) DEFAULT 'szt.',
    `unit_price_net` DECIMAL(12,2) NOT NULL,
    `vat_rate` INT(3) NOT NULL DEFAULT 23,
    `total_net` DECIMAL(12,2) NOT NULL,
    `total_gross` DECIMAL(12,2) NOT NULL,
    `is_optional` TINYINT(1) DEFAULT 0 COMMENT 'Pozycja opcjonalna',
    `sort_order` INT(11) DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_offer` (`offer_id`),
    CONSTRAINT `fk_items_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: gmail_threads - Wątki Gmail powiązane z CRM
-- =====================================================
CREATE TABLE IF NOT EXISTS `gmail_threads` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `thread_id` VARCHAR(100) NOT NULL COMMENT 'ID wątku Gmail',
    `job_id` INT(11) UNSIGNED DEFAULT NULL,
    `client_id` INT(11) UNSIGNED DEFAULT NULL,
    
    `subject` VARCHAR(500) DEFAULT NULL,
    `snippet` TEXT DEFAULT NULL,
    `from_email` VARCHAR(255) DEFAULT NULL,
    `from_name` VARCHAR(255) DEFAULT NULL,
    
    `message_count` INT(11) DEFAULT 0,
    `last_message_at` DATETIME DEFAULT NULL,
    `is_unread` TINYINT(1) DEFAULT 0,
    
    `labels` VARCHAR(500) DEFAULT NULL COMMENT 'Etykiety Gmail',
    `synced_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_thread` (`thread_id`),
    KEY `idx_job` (`job_id`),
    KEY `idx_client` (`client_id`),
    CONSTRAINT `fk_threads_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_threads_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: gmail_messages - Pojedyncze wiadomości
-- =====================================================
CREATE TABLE IF NOT EXISTS `gmail_messages` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `message_id` VARCHAR(100) NOT NULL COMMENT 'ID wiadomości Gmail',
    `thread_id` VARCHAR(100) NOT NULL,
    
    `from_email` VARCHAR(255) DEFAULT NULL,
    `from_name` VARCHAR(255) DEFAULT NULL,
    `to_email` VARCHAR(255) DEFAULT NULL,
    `subject` VARCHAR(500) DEFAULT NULL,
    `body_text` LONGTEXT DEFAULT NULL,
    `body_html` LONGTEXT DEFAULT NULL,
    
    `has_attachments` TINYINT(1) DEFAULT 0,
    `attachments_json` TEXT DEFAULT NULL COMMENT 'JSON z listą załączników',
    
    `sent_at` DATETIME DEFAULT NULL,
    `received_at` DATETIME DEFAULT NULL,
    `is_outgoing` TINYINT(1) DEFAULT 0 COMMENT '1 = wysłana przez nas',
    
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_message` (`message_id`),
    KEY `idx_thread` (`thread_id`),
    KEY `idx_from` (`from_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ROZSZERZENIE: jobs - dodatkowe pola
-- =====================================================
ALTER TABLE `jobs` 
ADD COLUMN IF NOT EXISTS `client_id` INT(11) UNSIGNED DEFAULT NULL AFTER `id`,
ADD COLUMN IF NOT EXISTS `offer_id` INT(11) UNSIGNED DEFAULT NULL AFTER `client_id`,
ADD COLUMN IF NOT EXISTS `gmail_thread_id` VARCHAR(100) DEFAULT NULL AFTER `offer_id`,
ADD COLUMN IF NOT EXISTS `payment_status` ENUM('none', 'proforma', 'invoice', 'partial', 'paid', 'cash', 'overdue') DEFAULT 'none' AFTER `column_id`,
ADD COLUMN IF NOT EXISTS `total_net` DECIMAL(12,2) DEFAULT 0 AFTER `payment_status`,
ADD COLUMN IF NOT EXISTS `total_gross` DECIMAL(12,2) DEFAULT 0 AFTER `total_net`,
ADD COLUMN IF NOT EXISTS `paid_amount` DECIMAL(12,2) DEFAULT 0 AFTER `total_gross`;

-- Dodaj klucze obce jeśli nie istnieją
-- ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL;
-- ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`) ON DELETE SET NULL;

-- =====================================================
-- TABELA: activity_log - Historia aktywności
-- =====================================================
CREATE TABLE IF NOT EXISTS `activity_log` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) UNSIGNED DEFAULT NULL,
    `entity_type` ENUM('job', 'client', 'invoice', 'offer') NOT NULL,
    `entity_id` INT(11) UNSIGNED NOT NULL,
    `action` VARCHAR(50) NOT NULL COMMENT 'created, updated, deleted, status_changed, email_sent',
    `description` VARCHAR(500) DEFAULT NULL,
    `old_value` TEXT DEFAULT NULL,
    `new_value` TEXT DEFAULT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_entity` (`entity_type`, `entity_id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- WIDOKI POMOCNICZE
-- =====================================================

-- Widok: Statystyki klienta
CREATE OR REPLACE VIEW `v_client_stats` AS
SELECT 
    c.id,
    c.company_name,
    c.type,
    COUNT(DISTINCT j.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN j.status = 'COMPLETED' THEN j.id END) as completed_jobs,
    COUNT(DISTINCT i.id) as total_invoices,
    COALESCE(SUM(i.total_gross), 0) as total_invoiced,
    COALESCE(SUM(i.paid_amount), 0) as total_paid,
    MAX(j.created_at) as last_job_date,
    MAX(i.created_at) as last_invoice_date
FROM clients c
LEFT JOIN jobs j ON c.id = j.client_id
LEFT JOIN invoices i ON c.id = i.client_id
GROUP BY c.id;

-- Widok: Zlecenia z danymi klienta i płatności
CREATE OR REPLACE VIEW `v_jobs_full` AS
SELECT 
    j.*,
    c.company_name as client_company,
    c.first_name as client_first_name,
    c.last_name as client_last_name,
    c.email as client_email,
    c.phone as client_phone,
    c.nip as client_nip,
    i.id as invoice_id,
    i.number as invoice_number,
    i.payment_status as invoice_status,
    o.offer_number,
    o.status as offer_status
FROM jobs j
LEFT JOIN clients c ON j.client_id = c.id
LEFT JOIN invoices i ON j.id = i.job_id AND i.type = 'invoice'
LEFT JOIN offers o ON j.offer_id = o.id;

-- =====================================================
-- DANE POCZĄTKOWE
-- =====================================================

-- Przykładowy klient testowy
INSERT INTO `clients` (`type`, `company_name`, `nip`, `email`, `phone`, `street`, `city`, `post_code`, `notes`) VALUES
('company', 'Testowa Firma Sp. z o.o.', '1234567890', 'test@example.com', '500 100 200', 'ul. Testowa 1', 'Warszawa', '00-001', 'Klient testowy do celów demonstracyjnych')
ON DUPLICATE KEY UPDATE `company_name` = VALUES(`company_name`);

-- =====================================================
-- KONIEC SCHEMATU V2
-- =====================================================









