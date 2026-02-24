import "./globals.css";

export const metadata = {
  title: "Queue System - Auth Tester",
  description: "Generate Firebase tokens for API testing",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* The children prop is where your page.js content will be injected */}
        {children}
      </body>
    </html>
  );
}