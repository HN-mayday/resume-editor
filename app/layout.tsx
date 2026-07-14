import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "纸上简历｜自由 A4 简历编辑器",
  description: "自由编写、排版、添加照片并导出多页 A4 PDF 的在线简历编辑器。",
  openGraph: {
    title: "纸上简历｜自由 A4 简历编辑器",
    description: "自由排版 · 多页 A4 · 导出 PDF",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "纸上简历编辑器" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "纸上简历｜自由 A4 简历编辑器",
    description: "自由排版 · 多页 A4 · 导出 PDF",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
