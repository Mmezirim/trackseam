-- AlterTable
ALTER TABLE `Tailor` ADD COLUMN `preferredUnit` VARCHAR(8) NOT NULL DEFAULT 'in';

-- AlterTable
ALTER TABLE `Measurement` ADD COLUMN `unit` VARCHAR(8) NOT NULL DEFAULT 'cm';
