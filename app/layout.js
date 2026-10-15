import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "Althakeel Interview",
  description: "Timed interviews for Althakeel positions",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="strip-extension-attrs" strategy="beforeInteractive">
          {`(function () {
            var attr = "bis_skin_checked";
            function clean(node) {
              if (!node || node.nodeType !== 1) return;
              if (node.hasAttribute(attr)) node.removeAttribute(attr);
              var marked = node.querySelectorAll("[" + attr + "]");
              for (var i = 0; i < marked.length; i++) marked[i].removeAttribute(attr);
            }
            clean(document.documentElement);
            var observer = new MutationObserver(function () { clean(document.documentElement); });
            observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: [attr] });
            setTimeout(function () { observer.disconnect(); }, 5000);
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
