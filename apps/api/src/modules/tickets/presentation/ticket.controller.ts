import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { AnonymousSessionGuard } from "../../auth/presentation/anonymous-session.guard";
import { AttendantSessionGuard } from "../../auth/presentation/attendant-session.guard";
import { CsrfGuard } from "../../auth/presentation/csrf.guard";
import { RequestLike } from "../../auth/presentation/http-types";
import { TrustedOriginGuard } from "../../auth/presentation/trusted-origin.guard";
import { TicketService } from "../application/ticket.service";
import { CreateTicketDto } from "./create-ticket.dto";
import { ListTicketsQuery } from "./list-tickets.query";
import { UpdateTicketDto } from "./update-ticket.dto";

@Controller("tickets")
export class TicketController {
  constructor(private readonly service: TicketService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AnonymousSessionGuard, TrustedOriginGuard)
  create(
    @Body() body: CreateTicketDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Req() request: RequestLike
  ) {
    return this.service.createConfirmed(request.organizationContext!, {
      ...body,
      idempotencyKey: idempotencyKey ?? ""
    });
  }

  @Get()
  @UseGuards(AttendantSessionGuard)
  list(@Query() query: ListTicketsQuery, @Req() request: RequestLike) {
    return this.service.list(request.organizationContext!, { status: query.status, priority: query.priority });
  }

  @Get(":ticketId")
  @UseGuards(AttendantSessionGuard)
  find(@Param("ticketId", new ParseUUIDPipe()) ticketId: string, @Req() request: RequestLike) {
    return this.service.detail(request.organizationContext!, ticketId);
  }

  @Patch(":ticketId")
  @UseGuards(AttendantSessionGuard, CsrfGuard, TrustedOriginGuard)
  update(
    @Param("ticketId", new ParseUUIDPipe()) ticketId: string,
    @Body() body: UpdateTicketDto,
    @Req() request: RequestLike
  ) {
    return this.service.updateManual(request.organizationContext!, ticketId, body);
  }
}
