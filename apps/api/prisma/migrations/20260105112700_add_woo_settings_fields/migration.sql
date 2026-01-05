-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "wooBaseUrl" TEXT,
ADD COLUMN     "wooConsumerKey" TEXT,
ADD COLUMN     "wooConsumerSecret" TEXT,
ADD COLUMN     "wooSyncImages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wooSyncProducts" BOOLEAN NOT NULL DEFAULT false;
