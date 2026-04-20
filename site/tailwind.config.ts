import typography from '@tailwindcss/typography'

export default {
  plugins: [typography],
  theme: {
    extend: {
      colors: {
        ztl: {
          cyan:       '#79C6BC',
          red:        '#EA5165',
          navy:       '#F5F4FF',
          anthracite: '#333333',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
}
