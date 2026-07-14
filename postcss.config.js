// Only processes imported .css files (FreightIQ's own styles are inline JS
// strings, untouched). The single .css file is src/budget-tailwind.css.
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
