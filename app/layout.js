export const metadata = {
  title: "ShareChat Trending — भारत अभी किस बारे में बात कर रहा है",
  description: "Automatically surfaces what India is talking about right now. Built for ShareChat APM Assignment.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800;900&family=Noto+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#0C0D12",
          fontFamily:
            "'Noto Sans Devanagari', 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
