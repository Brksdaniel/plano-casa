import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ConfigError } from '@/components/config-error'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { checkPublicEnv } from '@/lib/env'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'DENIELS HOME TRACKER', template: '%s · DENIELS HOME TRACKER' },
  description: 'Monitoramento inteligente dos apartamentos que você acompanha.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const envCheck = checkPublicEnv()

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            {envCheck.ok ? children : <ConfigError variable={envCheck.variable} />}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
