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
          content="CafeQR — table QR menus and cash ordering for independent cafes. Print codes, add your menu, go live in one sitting."
        />
        <meta name="theme-color" content="#F5F4F0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CafeQR" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:title" content="CafeQR — QR menus for small cafes" />
        <meta
          property="og:description"
          content="Table QR menus and cash ordering for independent cafés."
        />
        <title>CafeQR — QR menus for small cafes</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; background: #F5F4F0; }
              body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
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
