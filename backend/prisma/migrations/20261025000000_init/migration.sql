-- CreateTable
CREATE TABLE `Tailor` (
    `id` VARCHAR(36) NOT NULL,
    `shopName` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `passwordResetToken` VARCHAR(64) NULL,
    `passwordResetExpires` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tailor_email_key`(`email`),
    INDEX `Tailor_passwordResetToken_idx`(`passwordResetToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(36) NOT NULL,
    `tailorId` VARCHAR(36) NOT NULL,
    `clientId` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `notes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Client_tailorId_name_idx`(`tailorId`, `name`),
    INDEX `Client_tailorId_createdAt_idx`(`tailorId`, `createdAt`),
    UNIQUE INDEX `Client_tailorId_clientId_key`(`tailorId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Measurement` (
    `id` VARCHAR(36) NOT NULL,
    `clientRefId` VARCHAR(36) NOT NULL,
    `outfitType` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `fields` TEXT NOT NULL,
    `notes` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Measurement_clientRefId_createdAt_idx`(`clientRefId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_tailorId_fkey` FOREIGN KEY (`tailorId`) REFERENCES `Tailor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Measurement` ADD CONSTRAINT `Measurement_clientRefId_fkey` FOREIGN KEY (`clientRefId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

