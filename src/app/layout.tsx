import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "AI 客服工作台",
  description: "客服会话处理与 AI 辅助工作台",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
