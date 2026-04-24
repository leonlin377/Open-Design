import type { Metadata } from "next";
import "./tokens.css";
import "./globals.css";
import "./motion.css";
import { ClientProviders } from "./client-providers";
import { fontClassNames } from "./fonts";
import { detectLocaleServer } from "../lib/i18n/detect";

export const metadata: Metadata = {
  title: "OpenDesign Studio",
  description:
    "Artifact-first AI design workspace for websites, prototypes, and slides."
};

// Inlined before hydration so the first paint already matches the stored
// preference. Reading localStorage during render is unsafe, so keep this as a
// tiny bootstrap script tied to the <html> element.
const themeBootstrap = `
(function(){try{var t=localStorage.getItem('opendesign.theme');if(t!=='light'&&t!=='dark'&&t!=='system'){t='system';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','system');}})();
`.trim();

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const locale = await detectLocaleServer();

  return (
    <html
      lang={locale === "zh-CN" ? "zh-CN" : "en-US"}
      data-theme="system"
      className={fontClassNames}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ClientProviders initialLocale={locale}>{children}</ClientProviders>
      </body>
    </html>
  );
}
