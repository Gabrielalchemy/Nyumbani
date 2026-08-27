-- Document: track the server-side filename so originals can be served
ALTER TABLE "Document" ADD COLUMN "storedName" TEXT;

-- UssdScreen: drop unused ORDER_PAID_PROMPT value (Postgres requires type recreation)
CREATE TYPE "UssdScreen_new" AS ENUM ('MAIN', 'PRODUCT_LIST', 'PRODUCT_DETAIL', 'ORDER_QTY', 'ORDER_CONFIRM', 'MY_ORDERS', 'CONTACT');
ALTER TABLE "UssdSession" ALTER COLUMN "screen" DROP DEFAULT;
ALTER TABLE "UssdSession" ALTER COLUMN "screen" TYPE "UssdScreen_new" USING ("screen"::text::"UssdScreen_new");
DROP TYPE "UssdScreen";
ALTER TYPE "UssdScreen_new" RENAME TO "UssdScreen";
ALTER TABLE "UssdSession" ALTER COLUMN "screen" SET DEFAULT 'MAIN';
