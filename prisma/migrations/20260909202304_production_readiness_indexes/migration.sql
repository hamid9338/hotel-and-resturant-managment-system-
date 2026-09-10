-- CreateIndex
CREATE INDEX "Alert_type_entityId_resolved_idx" ON "Alert"("type", "entityId", "resolved");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_method_direction_createdAt_idx" ON "Payment"("method", "direction", "createdAt");

-- CreateIndex
CREATE INDEX "RestaurantOrder_status_createdAt_idx" ON "RestaurantOrder"("status", "createdAt");
