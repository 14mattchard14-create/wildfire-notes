import './globals.css'

export const metadata = {
  title: 'Field Notes — Wildfire Inspection',
  description: 'WPH field inspection intake tool',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-stone-950 text-stone-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
