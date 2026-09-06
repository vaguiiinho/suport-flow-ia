import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { ServiceHealth } from "@support-flow/shared";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<ServiceHealth> {
    try {
      await this.prisma.isReady();
      return {
        service: "api",
        status: "ok",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "ok"
        }
      };
    } catch {
      throw new ServiceUnavailableException({
        service: "api",
        status: "error",
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "error"
        }
      } satisfies ServiceHealth);
    }
  }
}
