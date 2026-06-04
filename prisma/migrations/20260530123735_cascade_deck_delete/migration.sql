-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_myDeckId_fkey";

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_myDeckId_fkey" FOREIGN KEY ("myDeckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
