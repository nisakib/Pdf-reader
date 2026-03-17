import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JP→EN PDF Translator",
  description: "Upload a Japanese PDF and get an English translation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #212529; min-height: 100vh; }
          a { color: #0070f3; text-decoration: none; }
          a:hover { text-decoration: underline; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
