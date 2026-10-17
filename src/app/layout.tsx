import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Britos Pediatria | Cuidado que acompanha cada fase", template: "%s | Britos Pediatria" },
  description: "Pediatria, puericultura e neonatologia com cuidado humanizado. Conheça a equipe e agende sua consulta on-line.",
  applicationName: "Britos Pediatria",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
