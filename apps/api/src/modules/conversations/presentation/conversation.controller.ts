import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AnonymousSessionGuard } from "../../auth/presentation/anonymous-session.guard";
import { RequestLike } from "../../auth/presentation/http-types";
import { TrustedOriginGuard } from "../../auth/presentation/trusted-origin.guard";
import { ConversationService } from "../application/conversation.service";
import { SendMessageDto } from "./send-message.dto";

@Controller("conversations")
export class ConversationController {
  constructor(private readonly service: ConversationService) {}

  @Post(":conversationId/messages")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AnonymousSessionGuard, TrustedOriginGuard)
  send(@Param("conversationId") conversationId: string, @Body() body: SendMessageDto, @Req() request: RequestLike) {
    return this.service.sendMessage(request.organizationContext!, conversationId, body.content, request.requestId);
  }
}
