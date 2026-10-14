import "./globals.css";

export const metadata = {
  title: "Althakeel Interview",
  description: "Timed interviews for Althakeel positions",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
