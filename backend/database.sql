-- =====================================================
-- CRM Zlecenia Montażowe - Schemat Bazy Danych
-- Wersja: 1.0
-- PHP: 5.6 compatible
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Tworzenie bazy danych (opcjonalnie - może już istnieć)
-- CREATE DATABASE IF NOT EXISTS montaz_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE montaz_crm;

-- =====================================================
-- TABELA: users - Użytkownicy systemu
-- =====================================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) DEFAULT NULL,
    `phone` VARCHAR(20) DEFAULT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'worker', 'printer') NOT NULL DEFAULT 'worker',
    `name` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `last_login` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_email` (`email`),
    UNIQUE KEY `unique_phone` (`phone`),
    KEY `idx_role` (`role`),
    KEY `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: sessions - Sesje użytkowników (tokeny)
-- =====================================================
CREATE TABLE IF NOT EXISTS `sessions` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT(11) UNSIGNED NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(45) DEFAULT NULL,
    `user_agent` VARCHAR(255) DEFAULT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_token` (`token`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_expires` (`expires_at`),
    CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: jobs - Zlecenia montażowe
-- =====================================================
CREATE TABLE IF NOT EXISTS `jobs` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `friendly_id` VARCHAR(20) NOT NULL COMMENT 'Czytelny ID np. #2024/001',
    `status` ENUM('NEW', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `column_id` ENUM('PREPARE', 'ANYTIME', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'COMPLETED') NOT NULL DEFAULT 'PREPARE',
    
    -- Dane zlecenia (JobOrderData)
    `job_title` VARCHAR(500) NOT NULL,
    `client_name` VARCHAR(255) DEFAULT NULL,
    `company_name` VARCHAR(255) DEFAULT NULL,
    `contact_person` VARCHAR(255) DEFAULT NULL,
    `phone_number` VARCHAR(50) DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `coordinates_lat` DECIMAL(10, 8) DEFAULT NULL,
    `coordinates_lng` DECIMAL(11, 8) DEFAULT NULL,
    
    -- Zakres prac
    `scope_work_text` TEXT DEFAULT NULL COMMENT 'Opis z maila/PDF',
    `scope_work_images` TEXT DEFAULT NULL COMMENT 'Analiza techniczna załączników',
    
    -- Płatność
    `payment_type` ENUM('CASH', 'TRANSFER', 'UNKNOWN') DEFAULT 'UNKNOWN',
    `payment_net_amount` DECIMAL(10, 2) DEFAULT NULL,
    `payment_gross_amount` DECIMAL(10, 2) DEFAULT NULL,
    
    -- Uwagi
    `admin_notes` TEXT DEFAULT NULL,
    
    -- Raport wykonania (przez pracownika)
    `completion_notes` TEXT DEFAULT NULL,
    `completed_at` DATETIME DEFAULT NULL,
    `completed_by` INT(11) UNSIGNED DEFAULT NULL,
    
    -- Metadane
    `created_by` INT(11) UNSIGNED DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_friendly_id` (`friendly_id`),
    KEY `idx_status` (`status`),
    KEY `idx_column` (`column_id`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_created_by` (`created_by`),
    CONSTRAINT `fk_jobs_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_jobs_completer` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: job_locations - Lokalizacje w zleceniu (wiele adresów)
-- =====================================================
CREATE TABLE IF NOT EXISTS `job_locations` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INT(11) UNSIGNED NOT NULL,
    `full_address` VARCHAR(500) NOT NULL,
    `short_label` VARCHAR(255) DEFAULT NULL,
    `distance` VARCHAR(50) DEFAULT NULL COMMENT 'np. 15 km od bazy',
    `sort_order` INT(11) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`),
    CONSTRAINT `fk_locations_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: job_images - Zdjęcia/pliki zlecenia
-- =====================================================
CREATE TABLE IF NOT EXISTS `job_images` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INT(11) UNSIGNED NOT NULL,
    `type` ENUM('project', 'completion') NOT NULL DEFAULT 'project' COMMENT 'project=załącznik, completion=zdjęcie z realizacji',
    `filename` VARCHAR(255) DEFAULT NULL,
    `file_path` VARCHAR(500) DEFAULT NULL COMMENT 'Ścieżka do pliku na serwerze',
    `file_data` LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded (alternatywa dla plików)',
    `mime_type` VARCHAR(100) DEFAULT 'image/jpeg',
    `is_cover` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Czy to okładka zlecenia',
    `sort_order` INT(11) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`),
    KEY `idx_type` (`type`),
    KEY `idx_cover` (`is_cover`),
    CONSTRAINT `fk_images_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: job_checklist - Checklista zadań
-- =====================================================
CREATE TABLE IF NOT EXISTS `job_checklist` (
    `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INT(11) UNSIGNED NOT NULL,
    `task` VARCHAR(500) NOT NULL,
    `is_checked` TINYINT(1) NOT NULL DEFAULT 0,
    `added_by` VARCHAR(100) DEFAULT NULL,
    `added_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_by` VARCHAR(100) DEFAULT NULL,
    `completed_at` DATETIME DEFAULT NULL,
    `sort_order` INT(11) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_job_id` (`job_id`),
    CONSTRAINT `fk_checklist_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABELA: settings - Ustawienia aplikacji
-- =====================================================
CREATE TABLE IF NOT EXISTS `settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT DEFAULT NULL,
    `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DANE POCZĄTKOWE
-- =====================================================

-- Domyślny administrator (hasło: admin123 - ZMIEŃ PO PIERWSZYM LOGOWANIU!)
INSERT INTO `users` (`email`, `phone`, `password_hash`, `role`, `name`) VALUES
('admin@montazreklam24.pl', '500000000', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Administrator')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Przykładowy pracownik (hasło: worker123)
INSERT INTO `users` (`email`, `phone`, `password_hash`, `role`, `name`) VALUES
('montazysta@montazreklam24.pl', '500000001', '$2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIVFlYg7B77UdFm', 'worker', 'Montażysta Jan')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Ustawienia domyślne
INSERT INTO `settings` (`key`, `value`) VALUES
('app_name', 'Montaż Reklam 24 - CRM'),
('default_logo', NULL),
('gemini_model', 'gemini-2.5-flash'),
('base_address', 'ul. Poprawna 39R, Warszawa')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- =====================================================
-- WIDOKI POMOCNICZE
-- =====================================================

-- Widok: aktywne zlecenia z liczbą zadań
CREATE OR REPLACE VIEW `v_jobs_summary` AS
SELECT 
    j.*,
    u.name AS creator_name,
    (SELECT COUNT(*) FROM job_checklist c WHERE c.job_id = j.id) AS total_tasks,
    (SELECT COUNT(*) FROM job_checklist c WHERE c.job_id = j.id AND c.is_checked = 1) AS completed_tasks,
    (SELECT file_data FROM job_images i WHERE i.job_id = j.id AND i.is_cover = 1 LIMIT 1) AS cover_image
FROM jobs j
LEFT JOIN users u ON j.created_by = u.id;

-- =====================================================
-- KONIEC SCHEMATU
-- =====================================================
