-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "homepage_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "homepage_images_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "homepage_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "homepage_buttons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "url" TEXT,
    "variant" TEXT NOT NULL DEFAULT 'primary',
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "homepage_buttons_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "homepage_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "media_library" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "used_in" TEXT,
    "uploaded_by" TEXT,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "homepage_sections_key_key" ON "homepage_sections"("key");

-- CreateIndex
CREATE INDEX "homepage_sections_key_idx" ON "homepage_sections"("key");

-- CreateIndex
CREATE INDEX "homepage_sections_order_idx" ON "homepage_sections"("order");

-- CreateIndex
CREATE INDEX "homepage_sections_is_visible_idx" ON "homepage_sections"("is_visible");

-- CreateIndex
CREATE INDEX "homepage_images_section_id_idx" ON "homepage_images"("section_id");

-- CreateIndex
CREATE INDEX "homepage_images_order_idx" ON "homepage_images"("order");

-- CreateIndex
CREATE INDEX "homepage_buttons_section_id_idx" ON "homepage_buttons"("section_id");

-- CreateIndex
CREATE INDEX "homepage_buttons_order_idx" ON "homepage_buttons"("order");

-- CreateIndex
CREATE UNIQUE INDEX "media_library_url_key" ON "media_library"("url");

-- CreateIndex
CREATE INDEX "media_library_used_in_idx" ON "media_library"("used_in");

-- CreateIndex
CREATE INDEX "media_library_uploaded_by_idx" ON "media_library"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_library_uploaded_at_idx" ON "media_library"("uploaded_at");
