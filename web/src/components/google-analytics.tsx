import Script from "next/script";

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID?.trim();
  if (!measurementId) return null;
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    throw new Error("NEXT_PUBLIC_GA_ID must be a GA4 measurement ID starting with G-.");
  }

  return (
    <>
      <Script id="tako-ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', ${JSON.stringify(measurementId)}, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
      <Script
        id="tako-ga-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
