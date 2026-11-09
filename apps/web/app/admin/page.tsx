import type { Metadata } from "next";
import { AdminConsole } from "./admin-console";

export const metadata: Metadata = { title: "Painel do atendente" };

export default function AdminPage() {
  return (
    <main>
      <AdminConsole />
    </main>
  );
}
