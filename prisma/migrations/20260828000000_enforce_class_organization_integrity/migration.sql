-- DropForeignKey
ALTER TABLE `classes` DROP FOREIGN KEY `classes_organizationId_fkey`;

-- AlterTable
ALTER TABLE `classes` MODIFY `organizationId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
