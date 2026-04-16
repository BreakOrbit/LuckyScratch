import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = getMetadata({
  title: "LuckyScratch - The Neon Sanctum",
  description:
    "Premium decentralized scratch-off ecosystem. Verifiable randomness meets cinematic gaming experiences on-chain.",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body
        suppressHydrationWarning
        className="bg-ns-background text-ns-on-surface font-body selection:bg-ns-primary selection:text-ns-background"
      >
        <Script src="https://cdn.zama.org/relayer-sdk-js/0.4.1/relayer-sdk-js.umd.cjs" strategy="beforeInteractive" />
        <ThemeProvider defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
