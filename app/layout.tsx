/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexusCompute | Zero-Install P2P Distributed AI Inference Network',
  description:
    'Pool heterogeneous client browser compute resources (WebGPU, WASM SIMD) dynamically via WebRTC to perform distributed LLM layer-sharded pipeline inference and verified map-reduce workloads.',
  keywords: [
    'Distributed AI',
    'P2P Compute',
    'Serverless Inference',
    'WebGPU LLM',
    'PeerJS WebRTC',
    'ONNX Runtime Web',
    'Decentralized AI'
  ],
  authors: [{ name: 'NexusCompute Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans bg-[#020617] text-[#f8fafc] flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
