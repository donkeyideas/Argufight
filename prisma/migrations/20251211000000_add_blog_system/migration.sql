-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "keywords" TEXT,
    "og_image" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "author_id" TEXT NOT NULL,
    "featured_image_id" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_post_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_to_categories" (
    "post_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "blog_post_to_categories_pkey" PRIMARY KEY ("post_id","category_id")
);

-- CreateTable
CREATE TABLE "blog_post_to_tags" (
    "post_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "blog_post_to_tags_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts"("published_at");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "blog_posts_featured_idx" ON "blog_posts"("featured");

-- CreateIndex
CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_categories_name_key" ON "blog_post_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_categories_slug_key" ON "blog_post_categories"("slug");

-- CreateIndex
CREATE INDEX "blog_post_categories_slug_idx" ON "blog_post_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_tags_name_key" ON "blog_post_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "blog_post_tags_slug_key" ON "blog_post_tags"("slug");

-- CreateIndex
CREATE INDEX "blog_post_tags_slug_idx" ON "blog_post_tags"("slug");

-- CreateIndex
CREATE INDEX "blog_post_to_categories_post_id_idx" ON "blog_post_to_categories"("post_id");

-- CreateIndex
CREATE INDEX "blog_post_to_categories_category_id_idx" ON "blog_post_to_categories"("category_id");

-- CreateIndex
CREATE INDEX "blog_post_to_tags_post_id_idx" ON "blog_post_to_tags"("post_id");

-- CreateIndex
CREATE INDEX "blog_post_to_tags_tag_id_idx" ON "blog_post_to_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_featured_image_id_fkey" FOREIGN KEY ("featured_image_id") REFERENCES "media_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_to_categories" ADD CONSTRAINT "blog_post_to_categories_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_to_categories" ADD CONSTRAINT "blog_post_to_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_post_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_to_tags" ADD CONSTRAINT "blog_post_to_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_to_tags" ADD CONSTRAINT "blog_post_to_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "blog_post_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;








