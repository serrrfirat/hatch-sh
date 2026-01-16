/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Degen color palette
        bg: {
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1a1a1a',
        },
        accent: {
          green: '#00ff88',
          orange: '#ff6b35',
          purple: '#a855f7',
          red: '#ef4444',
        },
        border: {
          DEFAULT: '#2a2a2a',
          hover: '#3a3a3a',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'glitch': 'glitch 0.3s ease-in-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
      },
      boxShadow: {
        'glow-green': '0 0 10px #00ff88, 0 0 20px #00ff8840',
        'glow-orange': '0 0 10px #ff6b35, 0 0 20px #ff6b3540',
        'glow-purple': '0 0 10px #a855f7, 0 0 20px #a855f740',
      },
      typography: {
        DEFAULT: {
          css: {
            color: 'rgb(229 231 235)', // text-gray-200
            maxWidth: 'none',
            p: {
              color: 'rgb(229 231 235)',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            h1: {
              color: 'rgb(255 255 255)',
              fontWeight: '700',
              fontSize: '1.25rem',
              marginTop: '1rem',
              marginBottom: '0.5rem',
            },
            h2: {
              color: 'rgb(255 255 255)',
              fontWeight: '700',
              fontSize: '1.125rem',
              marginTop: '0.75rem',
              marginBottom: '0.5rem',
            },
            h3: {
              color: 'rgb(255 255 255)',
              fontWeight: '600',
              fontSize: '1rem',
              marginTop: '0.75rem',
              marginBottom: '0.5rem',
            },
            strong: {
              color: 'rgb(255 255 255)',
              fontWeight: '600',
            },
            a: {
              color: '#00ff88', // accent-green
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            code: {
              color: '#00ff88',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            ul: {
              paddingLeft: '1.25rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            ol: {
              paddingLeft: '1.25rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            li: {
              color: 'rgb(229 231 235)',
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
            blockquote: {
              color: 'rgb(156 163 175)',
              borderLeftColor: 'rgb(75 85 99)',
              fontStyle: 'normal',
            },
            hr: {
              borderColor: 'rgba(255, 255, 255, 0.1)',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
