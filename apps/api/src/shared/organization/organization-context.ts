export type OrganizationActor =
  | { kind: "ATTENDANT"; userId: string; sessionId: string }
  | { kind: "ANONYMOUS"; conversationId: string; sessionId: string };

export interface OrganizationContext {
  organizationId: string;
  actor: OrganizationActor;
}
