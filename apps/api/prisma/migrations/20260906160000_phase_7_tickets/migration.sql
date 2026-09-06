CREATE TYPE "TicketAuditEventType" AS ENUM ('CREATED', 'UPDATED');

CREATE TABLE "TicketAuditEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorUserId" UUID,
    "type" "TicketAuditEventType" NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TicketAuditEvent_organizationId_ticketId_createdAt_idx" ON "TicketAuditEvent"("organizationId", "ticketId", "createdAt");
ALTER TABLE "TicketAuditEvent" ADD CONSTRAINT "TicketAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketAuditEvent" ADD CONSTRAINT "TicketAuditEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
