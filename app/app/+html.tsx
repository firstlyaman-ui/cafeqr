import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta
          name="description"
          content="CafeQred — table QR menus and cash ordering for independent cafes. Print codes, add your menu, go live in one sitting."
        />
        <meta name="theme-color" content="#F5F4F0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CafeQred" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:title" content="CafeQred — QR menus for small cafes" />
        <meta
          property="og:description"
          content="Table QR menus and cash ordering for independent cafés."
        />
        <title>CafeQred — QR menus for small cafes</title>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; background: #F5F4F0; }
              body { margin: 0; font-family: "DM Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
              h1, h2, .font-display { font-family: Fraunces, Georgia, "Times New Roman", serif; }
              input, textarea, button { font-family: inherit; }
              * { box-sizing: border-box; }
              @media print {
                header, nav, .no-print, [data-noprint="true"] { display: none !important; }
                body, #root {
                  background: #fff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                @page { margin: 10mm; size: auto; }
                .qr-print-sheet, .qr-sheet, .qr-print-grid, .qr-print-cell {
                  display: block !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .qr-print-grid {
                  display: flex !important;
                  flex-wrap: wrap !important;
                  gap: 8mm !important;
                  justify-content: center !important;
                }
                .qr-print-cell {
                  break-inside: avoid;
                  page-break-inside: avoid;
                  width: 42mm !important;
                  text-align: center;
                  background: #fff !important;
                }
                .qr-print-cell img, .qr-sheet img, img.qr-img {
                  display: inline-block !important;
                  visibility: visible !important;
                  width: 36mm !important;
                  height: 36mm !important;
                  max-width: 36mm !important;
                  background: #fff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
