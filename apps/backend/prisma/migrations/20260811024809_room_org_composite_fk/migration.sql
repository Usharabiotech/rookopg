-- DropForeignKey
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_propertyId_fkey";

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_propertyId_orgId_fkey" FOREIGN KEY ("propertyId", "orgId") REFERENCES "properties"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
