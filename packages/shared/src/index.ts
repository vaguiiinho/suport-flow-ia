export type ServiceName = "web" | "api" | "worker";
export type HealthState = "ok" | "error";

export interface ServiceHealth {
  service: ServiceName;
  status: HealthState;
  timestamp: string;
  dependencies?: Record<string, HealthState>;
}
