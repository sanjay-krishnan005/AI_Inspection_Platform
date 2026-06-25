import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AIInspect Pro',
    short_name: 'AIInspect',
    description: 'Construction Intelligence Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1121', // Match var(--bg)
    theme_color: '#00BCD4', // Match var(--teal)
    icons: [
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
