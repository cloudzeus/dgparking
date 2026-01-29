/**
 * Pages Router document. Required when using pages/_error.tsx so the Pages Router has a valid _document.
 * Wraps all Pages Router pages (e.g. /500) with Html, Head, Main, NextScript.
 */
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
