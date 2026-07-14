/** @type {import('tailwindcss').Config} */
// Scoped Tailwind for the ported Budget Calendar tab ONLY. `preflight:false`
// disables Tailwind's global CSS reset so it can't touch FreightIQ's inline-
// styled UI, and `important:'.budget-root'` prefixes every utility with
// `.budget-root ` so the classes only apply inside the budget tab's wrapper.
// `content` scans only BudgetCalendar.jsx, so no other file's markup generates CSS.
export default {
  content: ['./src/BudgetCalendar.jsx'],
  corePlugins: { preflight: false },
  important: '.budget-root',
  theme: { extend: {} },
  plugins: [],
};
