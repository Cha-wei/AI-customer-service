import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "客服工作台",
  description: "AI Customer Service Workbench 管理界面",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
