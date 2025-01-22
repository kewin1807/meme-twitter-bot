-- CreateTable
CREATE TABLE "kols" (
    "id" SERIAL NOT NULL,
    "handle_name" TEXT NOT NULL,
    "last_post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kols_pkey" PRIMARY KEY ("id")
);
