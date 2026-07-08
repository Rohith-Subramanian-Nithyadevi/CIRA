/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
   theme: {
   	extend: {
   		fontFamily: {
   			sans: [
   				'Inter',
   				'sans-serif'
   			],
   			serif: [
   				'Outfit',
   				'sans-serif'
   			]
   		},
   		borderRadius: {
   			lg: 'var(--radius)',
   			md: 'calc(var(--radius) - 2px)',
   			sm: 'calc(var(--radius) - 4px)'
   		},
   		colors: {
   			cream: 'var(--bg-cream)',
   			'cream-edge': 'var(--bg-cream-edge)',
   			maroon: 'var(--maroon)',
   			'maroon-deep': 'var(--maroon-deep)',
   			ink: 'var(--ink)',
   			'gray-body': 'var(--gray-body)',
   			'chip-peach': 'var(--chip-peach)',
   			'cta-tan': 'var(--cta-tan)',
   			'border-soft': 'var(--border-soft)',
   			background: 'var(--background)',
   			foreground: 'var(--foreground)',
   			card: {
   				DEFAULT: 'var(--card)',
   				foreground: 'var(--card-foreground)'
   			},
   			popover: {
   				DEFAULT: 'var(--popover)',
   				foreground: 'var(--popover-foreground)'
   			},
   			primary: {
   				DEFAULT: 'var(--primary)',
   				foreground: 'var(--primary-foreground)'
   			},
   			secondary: {
   				DEFAULT: 'var(--secondary)',
   				foreground: 'var(--secondary-foreground)'
   			},
   			muted: {
   				DEFAULT: 'var(--muted)',
   				foreground: 'var(--muted-foreground)'
   			},
   			accent: {
   				DEFAULT: 'var(--accent)',
   				foreground: 'var(--accent-foreground)'
   			},
   			destructive: {
   				DEFAULT: 'var(--destructive)',
   				foreground: 'var(--destructive-foreground)'
   			},
   			border: 'var(--border)',
   			input: 'var(--input)',
   			ring: 'var(--ring)',
   			chart: {
   				'1': 'var(--chart-1)',
   				'2': 'var(--chart-2)',
   				'3': 'var(--chart-3)',
   				'4': 'var(--chart-4)',
   				'5': 'var(--chart-5)'
   			}
   		}
   	}
   },
   plugins: [require("tailwindcss-animate")],
}
