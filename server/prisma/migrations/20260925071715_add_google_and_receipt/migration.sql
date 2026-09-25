-- AlterTable
ALTER TABLE "products" ADD COLUMN     "enable3D" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hotspots" JSONB,
ADD COLUMN     "model3DPoster" TEXT,
ADD COLUMN     "model3DUrl" TEXT;
