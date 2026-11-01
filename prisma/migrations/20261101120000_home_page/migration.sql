-- The customer home page becomes staff-managed (/admin/home): banners and category tiles, in the history log.
ALTER TYPE "AuditAction" ADD VALUE 'HOME_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'HOME_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'HOME_DELETED';

ALTER TYPE "AuditEntity" ADD VALUE 'HOME';

CREATE TABLE "HomeBanner" (
    "id" TEXT NOT NULL,
    "titleBn" TEXT NOT NULL,
    "titleEn" TEXT,
    "bodyBn" TEXT,
    "bodyEn" TEXT,
    "ctaBn" TEXT,
    "ctaEn" TEXT,
    "target" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageKey" TEXT,
    "imageMime" TEXT,
    "imageSize" INTEGER,
    "imageUpdatedAt" TIMESTAMP(3),
    "defaultImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeCategory" (
    "id" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "nameEn" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'blue',
    "addsItem" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageKey" TEXT,
    "imageMime" TEXT,
    "imageSize" INTEGER,
    "imageUpdatedAt" TIMESTAMP(3),
    "defaultImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomeBanner_isActive_sortOrder_idx" ON "HomeBanner"("isActive", "sortOrder");
CREATE INDEX "HomeCategory_isActive_sortOrder_idx" ON "HomeCategory"("isActive", "sortOrder");

-- The page as it was hard-coded, so nothing changes until staff change it. Here rather than in the seed,
-- so a row staff delete doesn't come back.
INSERT INTO "HomeBanner" ("id", "titleBn", "titleEn", "bodyBn", "bodyEn", "ctaBn", "ctaEn", "target", "sortOrder", "defaultImage", "updatedAt") VALUES
  ('home_banner_bazar', 'তাজা বাজার সরাসরি আপনার বাসায়', 'Fresh groceries, straight to your door', 'বাজারের লিস্ট লিখে দিন, আমরা বাজার করে বাসায় পৌঁছে দেব।', 'Write your list; we do the shopping and bring it home.', 'এখনই অর্ডার করুন', 'Order now', 'bazar', 0, '/images/bazar-800.webp', CURRENT_TIMESTAMP);

INSERT INTO "HomeCategory" ("id", "nameBn", "nameEn", "tone", "addsItem", "sortOrder", "defaultImage", "updatedAt") VALUES
  ('home_cat_fish', 'মাছ', 'Fish', 'blue', true, 0, '/images/cat-fish-800.webp', CURRENT_TIMESTAMP),
  ('home_cat_meat', 'মাংস', 'Meat', 'coral', true, 1, '/images/cat-meat-800.webp', CURRENT_TIMESTAMP),
  ('home_cat_vegetables', 'সবজি', 'Vegetables', 'green', true, 2, '/images/cat-vegetables-800.webp', CURRENT_TIMESTAMP),
  ('home_cat_rice', 'চাল-ডাল', 'Rice & lentils', 'orange', true, 3, '/images/cat-rice-800.webp', CURRENT_TIMESTAMP),
  ('home_cat_daily', 'দৈনন্দিন পণ্য', 'Daily needs', 'violet', true, 4, '/images/cat-daily-800.webp', CURRENT_TIMESTAMP),
  ('home_cat_more', 'আরও', 'More', 'neutral', false, 5, '/images/cat-more-800.webp', CURRENT_TIMESTAMP);
