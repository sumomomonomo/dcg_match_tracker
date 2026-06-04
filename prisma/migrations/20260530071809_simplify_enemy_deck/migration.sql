/*
  Warnings:

  - You are about to drop the column `enemyDeckId` on the `Match` table. All the data in the column will be lost.
  - Added the required column `enemyDeckName` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_enemyDeckId_fkey";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "enemyDeckId",
ADD COLUMN     "enemyDeckName" TEXT NOT NULL;
