import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
              color: 'rgb(74 222 128)', // accent-green
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            code: {
              color: 'rgb(74 222 128)',
              backgroundColor: 'rgba(255 255 255 / 0.1)',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
              '&::before': {
                content: '""',
              },
              '&::after': {
                content: '""',
              },
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
              borderColor: 'rgba(255 255 255 / 0.1)',
            },
          },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
