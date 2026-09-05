import { ScrollViewStyleReset } from "expo-router/html";
import type { ReactNode } from "react";

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta
          name="description"
          content="CafeQR — table QR menus and cash ordering for independent cafes. Print codes, add your menu, go live in one sitting."
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
                body { background: #fff !important; }
                @page { margin: 12mm; }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
