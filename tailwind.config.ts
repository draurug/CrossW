import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Цвета клетки задаются токенами, а не хардкодом в компонентах:
        // тёмная тема переопределяет их в globals.css одним местом.
        cell: {
          bg: 'var(--cell-bg)',
          block: 'var(--cell-block)',
          line: 'var(--cell-line)',
          active: 'var(--cell-active)',
          word: 'var(--cell-word)',
          wrong: 'var(--cell-wrong)',
          correct: 'var(--cell-correct)',
          hint: 'var(--cell-hint)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
