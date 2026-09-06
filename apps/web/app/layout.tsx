import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: {
    default: "SupportFlow AI",
    template: "%s | SupportFlow AI"
  },
  description: "Central de suporte com respostas assistidas, fontes verificáveis e escalonamento humano."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
