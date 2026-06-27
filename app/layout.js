import { AuthProvider } from '@/components/AuthProvider'
import './globals.css'

export const metadata = {
  title: 'Wildfire Field Notes',
  description: 'Site intake for wildfire inspections',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
