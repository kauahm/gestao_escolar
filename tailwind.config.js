/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';
import defaultTheme from 'tailwindcss/defaultTheme';

// Base visual do Gestão Escolar (ver docs/18-design.md).
// - Azul da marca #185FA5 mantido como cor principal, agora com escala completa.
// - Cinzas levemente azulados (a escala "slate") no lugar dos cinzas neutros:
//   todas as classes gray-* do sistema passam a usar esses tons, de uma vez só.
// - Fonte Inter (gratuita), servida pelo próprio sistema.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Cinzas azulados; o 500 (texto secundário) foi escurecido para ter
        // contraste de 4,5:1 até sobre fundos coloridos claros (acessibilidade).
        gray: { ...colors.slate, 500: '#57667b' },
        // Verde, laranja e vermelho: o tom 600 (usado em textos e botões) sobe
        // um nível, pelo mesmo motivo. O 700 acompanha, para o "passar o mouse".
        green: { ...colors.green, 600: colors.green[700], 700: colors.green[800] },
        orange: { ...colors.orange, 600: colors.orange[700], 700: colors.orange[800] },
        red: { ...colors.red, 600: colors.red[700], 700: colors.red[800] },
        primary: {
          DEFAULT: '#185FA5',
          light: '#2a7bc9',
          dark: '#114478',
          50: '#EEF5FC',
          100: '#D9E8F7',
          200: '#B4D1EF',
          300: '#83B2E3',
          400: '#4F8DD2',
          500: '#2A70BE',
          600: '#185FA5',
          700: '#144F89',
          800: '#114478',
          900: '#0D3157',
        },
        danger: '#DC2626',
        warning: '#F59E0B',
        success: '#10B981',
        neutral: {
          100: colors.slate[100],
          200: colors.slate[200],
          300: colors.slate[300],
          800: colors.slate[800],
          900: colors.slate[900],
        },
      },
      boxShadow: {
        // Sombra de cartão mais suave e "fria", combinando com os cinzas azulados.
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
}
