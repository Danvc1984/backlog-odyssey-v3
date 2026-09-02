import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { VisualPreferencesProvider } from "@/components/preferences/VisualPreferencesProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const prePaintVisualPreferences = `(function(){try{var m=localStorage.getItem("backlog-odyssey:motion"),d=localStorage.getItem("backlog-odyssey:data"),r=document.documentElement;if(m==="reduced")r.setAttribute("data-motion","reduced");else if(m==="full")r.setAttribute("data-motion","full");if(d==="on")r.setAttribute("data-reduced-data","on");else if(d==="off")r.setAttribute("data-reduced-data","off");}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Backlog Odyssey",
  description:
    "Private gaming library, wishlist, and decision assistant for a fixed Bazzite / Steam Deck / Windows setup.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="pre-paint-visual-preferences" strategy="beforeInteractive">
          {prePaintVisualPreferences}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <VisualPreferencesProvider>
            {children}
            <Toaster />
          </VisualPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
