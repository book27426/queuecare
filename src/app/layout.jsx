import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import "@mantine/core/styles.css";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          {children} {/* This renders the specific pages with their own navbars */}
        </MantineProvider>
      </body>
    </html>
  );
}