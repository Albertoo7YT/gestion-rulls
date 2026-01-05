import "./globals.css";
import ScrollNav from "./scroll-nav";
import AuthShell from "./auth-shell";

export const metadata = {
  title: "Programa de gestion",
  description: "Panel de gestion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ScrollNav />
        <AuthShell>{children}</AuthShell>
      </body>
    </html>
  );
}
