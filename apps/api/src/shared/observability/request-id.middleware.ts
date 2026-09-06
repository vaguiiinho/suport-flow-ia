import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";

interface RequestWithId {
  requestId?: string;
}

interface ResponseWithHeader {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: ResponseWithHeader, next: () => void): void {
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  }
}
