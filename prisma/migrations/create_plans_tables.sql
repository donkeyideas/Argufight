-- Migration: Create Plans Board Tables
-- Run this SQL directly in your database if Prisma migrations don't work

-- Create boards table
CREATE TABLE IF NOT EXISTS "boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#0079bf',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- Create lists table
CREATE TABLE IF NOT EXISTS "lists" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- Create cards table
CREATE TABLE IF NOT EXISTS "cards" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- Create card_labels table
CREATE TABLE IF NOT EXISTS "card_labels" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#61bd4f',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_labels_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "boards_is_archived_idx" ON "boards"("is_archived");
CREATE INDEX IF NOT EXISTS "lists_board_id_idx" ON "lists"("board_id");
CREATE INDEX IF NOT EXISTS "lists_position_idx" ON "lists"("position");
CREATE INDEX IF NOT EXISTS "cards_list_id_idx" ON "cards"("list_id");
CREATE INDEX IF NOT EXISTS "cards_position_idx" ON "cards"("position");
CREATE INDEX IF NOT EXISTS "card_labels_card_id_idx" ON "card_labels"("card_id");

-- Add foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'lists_board_id_fkey'
    ) THEN
        ALTER TABLE "lists" ADD CONSTRAINT "lists_board_id_fkey" 
        FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'cards_list_id_fkey'
    ) THEN
        ALTER TABLE "cards" ADD CONSTRAINT "cards_list_id_fkey" 
        FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'card_labels_card_id_fkey'
    ) THEN
        ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_card_id_fkey" 
        FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;








