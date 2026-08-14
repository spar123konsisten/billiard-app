import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
 
import AiChat from './components/AiChat';const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sparring App",
  description: "Platform sparring billiard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        
        {/* ===== AI ASSISTANT DI SINI ===== */}
        <AiChat />
      </body>
    </html>
  );
}