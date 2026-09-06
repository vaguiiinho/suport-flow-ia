import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TicketService } from "./application/ticket.service";
import { TICKET_REPOSITORY } from "./domain/ticket-repository.port";
import { PrismaTicketRepository } from "./infrastructure/prisma-ticket.repository";
import { TicketController } from "./presentation/ticket.controller";

@Module({
  imports: [AuthModule],
  controllers: [TicketController],
  providers: [TicketService, { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository }]
})
export class TicketsModule {}
