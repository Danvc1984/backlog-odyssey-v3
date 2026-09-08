import type { Metadata } from "next";
import Script from "next/script";
import { Cinzel, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { VisualPreferencesProvider } from "@/components/preferences/VisualPreferencesProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const prePaintVisualPreferences = `(function(){try{var m=localStorage.getItem("backlog-odyssey:motion"),d=localStorage.getItem("backlog-odyssey:data"),f=localStorage.getItem("backlog-odyssey:family"),r=document.documentElement,i=document.querySelector('link[rel="icon"]');if(m==="reduced")r.setAttribute("data-motion","reduced");else if(m==="full")r.setAttribute("data-motion","full");if(d==="on")r.setAttribute("data-reduced-data","on");else if(d==="off")r.setAttribute("data-reduced-data","off");if(f==="sunset")r.setAttribute("data-family","sunset");if(i)i.href=f==="sunset"?"/dragon-icon-sunset.svg":"/dragon-icon-dawn.svg";}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Backlog Odyssey",
  description:
    "Private gaming library, wishlist, and decision assistant for a configurable Linux / Steam Deck / Windows setup.",
  icons: {
    icon: "/dragon-icon-dawn.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${cinzel.variable} ${geistMono.variable} h-full antialiased`}
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
