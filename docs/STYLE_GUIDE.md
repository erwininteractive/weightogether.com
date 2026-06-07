# UI Style Guide

This document describes the design language and styling conventions for client-facing pages in the application.

## Design Principles

1. **Clean & Modern** - Minimal visual clutter, generous whitespace
2. **Consistent** - Reusable patterns across all pages
3. **Accessible** - High contrast, clear typography, focus states
4. **Responsive** - Mobile-first approach, works on all screen sizes

---

## Color Palette

### Primary Colors

| Color     | Tailwind Class                   | Usage                             |
| --------- | -------------------------------- | --------------------------------- |
| Slate 800 | `text-slate-800`, `bg-slate-800` | Headers, navigation, primary text |
| Blue 500  | `bg-blue-500`, `text-blue-500`   | Primary buttons, links, accents   |
| Blue 600  | `hover:bg-blue-600`              | Button hover states               |

### Secondary Colors

| Color    | Tailwind Class  | Usage                     |
| -------- | --------------- | ------------------------- |
| Gray 100 | `bg-gray-100`   | Page background           |
| Gray 500 | `text-gray-500` | Secondary text, labels    |
| Gray 600 | `text-gray-600` | Descriptions, helper text |
| White    | `bg-white`      | Cards, content areas      |

### Status Colors

| Status  | Background                      | Text                                 | Usage                             |
| ------- | ------------------------------- | ------------------------------------ | --------------------------------- |
| Success | `bg-green-50`, `bg-green-100`   | `text-green-700`, `text-green-800`   | Success messages, positive badges |
| Warning | `bg-yellow-50`, `bg-yellow-100` | `text-yellow-700`, `text-yellow-800` | Warnings, pending states          |
| Error   | `bg-red-50`, `bg-red-100`       | `text-red-700`, `text-red-800`       | Errors, destructive actions       |
| Info    | `bg-blue-50`, `bg-blue-100`     | `text-blue-700`, `text-blue-800`     | Informational messages            |

---

## Typography

### Headings

```html
<!-- Page Title -->
<h1 class="text-3xl font-bold text-slate-800">Page Title</h1>

<!-- Section Title -->
<h2 class="text-xl font-semibold text-slate-800">Section Title</h2>

<!-- Card Title -->
<h3 class="text-lg font-semibold text-slate-800">Card Title</h3>
```

### Body Text

```html
<!-- Primary text -->
<p class="text-gray-800">Main content text</p>

<!-- Secondary/description text -->
<p class="text-gray-600">Description or helper text</p>

<!-- Small/label text -->
<p class="text-sm text-gray-500">Label or meta text</p>

<!-- Extra small text -->
<p class="text-xs text-gray-500">Fine print or hints</p>
```

---

## Components

### Cards

Standard content container with shadow and rounded corners.

```html
<div class="bg-white p-6 rounded-lg shadow">
	<h2 class="text-lg font-semibold text-slate-800 mb-4">Card Title</h2>
	<p class="text-gray-600">Card content goes here.</p>
</div>
```

**Variants:**

- Default padding: `p-6` or `p-8`
- With margin bottom: `mb-4` or `mb-6`
- Full width in grid: part of responsive grid

### Buttons

#### Primary Button

```html
<button
	class="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
>
	Primary Action
</button>
```

#### Secondary Button

```html
<button
	class="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
>
	Secondary Action
</button>
```

#### Danger Button

```html
<button
	class="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
>
	Delete
</button>
```

#### Full Width Button

```html
<button
	class="w-full px-4 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
>
	Submit
</button>
```

### Form Inputs

#### Text Input

```html
<div>
	<label for="field" class="block text-sm font-medium text-gray-700 mb-2">
		Field Label
	</label>
	<input
		type="text"
		id="field"
		name="field"
		class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
		placeholder="Placeholder text"
	/>
</div>
```

#### Input with Helper Text

```html
<div>
	<label for="field" class="block text-sm font-medium text-gray-700 mb-2">
		Field Label <span class="text-red-500">*</span>
	</label>
	<input type="text" ... />
	<p class="mt-1 text-xs text-gray-500">Helper text or requirements</p>
</div>
```

#### Checkbox

```html
<label class="flex items-center">
	<input
		type="checkbox"
		class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
	/>
	<span class="ml-2 text-sm text-gray-600">Checkbox label</span>
</label>
```

### Alerts/Messages

#### Error Alert

```html
<div
	class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6"
>
	<div class="flex items-center gap-2">
		<svg
			class="w-5 h-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			></path>
		</svg>
		<span>Error message here</span>
	</div>
</div>
```

#### Success Alert

```html
<div
	class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6"
>
	<div class="flex items-center gap-2">
		<svg
			class="w-5 h-5"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M5 13l4 4L19 7"
			></path>
		</svg>
		<span>Success message here</span>
	</div>
</div>
```

### Badges/Pills

```html
<!-- Success badge -->
<span
	class="inline-flex items-center px-2 py-1 text-sm font-medium bg-green-100 text-green-800 rounded"
>
	Active
</span>

<!-- Warning badge -->
<span
	class="inline-flex items-center px-2 py-1 text-sm font-medium bg-yellow-100 text-yellow-800 rounded"
>
	Pending
</span>

<!-- Info badge -->
<span
	class="inline-flex items-center px-2 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded"
>
	New
</span>

<!-- Neutral badge -->
<span
	class="inline-flex items-center px-2 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded"
>
	Default
</span>
```

### Stat Cards

```html
<div class="bg-white p-6 rounded-lg shadow">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm font-medium text-gray-500">Stat Label</p>
			<p class="text-2xl font-bold text-slate-800 mt-1">Value</p>
		</div>
		<div class="p-3 bg-blue-50 rounded-full">
			<!-- Icon here -->
			<svg class="w-6 h-6 text-blue-500">...</svg>
		</div>
	</div>
</div>
```

### Action Items / List Items

```html
<a
	href="/action"
	class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
>
	<div class="p-2 bg-blue-50 rounded-lg">
		<svg class="w-5 h-5 text-blue-500">...</svg>
	</div>
	<div>
		<p class="font-medium text-gray-800">Action Title</p>
		<p class="text-sm text-gray-500">Action description</p>
	</div>
</a>
```

---

## Layout Patterns

### Page Container

```html
<div class="max-w-6xl mx-auto p-8">
	<!-- Page content -->
</div>
```

### Centered Form (Auth Pages)

```html
<div class="min-h-[80vh] flex items-center justify-center">
	<div class="w-full max-w-md">
		<!-- Form card -->
	</div>
</div>
```

### Grid Layouts

```html
<!-- Stats grid (4 columns on large screens) -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
	<!-- Stat cards -->
</div>

<!-- Two column layout with sidebar -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
	<div class="lg:col-span-2">
		<!-- Main content -->
	</div>
	<div>
		<!-- Sidebar -->
	</div>
</div>
```

### Spacing

- Between sections: `space-y-6` or `mb-6`
- Between form fields: `space-y-5` or `mb-4`
- Inside cards: `p-6` or `p-8`
- Grid gaps: `gap-4` or `gap-6`

---

## Navigation

### Main Navigation Bar

```html
<nav class="bg-slate-800 text-white px-8 py-4">
	<ul class="flex gap-8">
		<li>
			<a href="/" class="hover:opacity-80 transition-opacity">Home</a>
		</li>
		<li>
			<a href="/dashboard" class="hover:opacity-80 transition-opacity"
				>Dashboard</a
			>
		</li>
		<!-- More items -->
	</ul>
</nav>
```

### Links

```html
<!-- Standard link -->
<a href="/page" class="text-blue-600 hover:text-blue-700 hover:underline"
	>Link text</a
>

<!-- Small link -->
<a href="/page" class="text-sm text-blue-600 hover:underline">Small link</a>
```

---

## Icons

Use Heroicons (outline style) for consistency. Include inline SVGs for optimal performance.

```html
<!-- Example: Check icon -->
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="2"
		d="M5 13l4 4L19 7"
	></path>
</svg>
```

Common icon sizes:

- Small (badges, inline): `w-4 h-4`
- Default (buttons, lists): `w-5 h-5`
- Large (stat cards): `w-6 h-6`

---

## Responsive Breakpoints

| Breakpoint | Prefix | Min Width |
| ---------- | ------ | --------- |
| Mobile     | (none) | 0px       |
| Small      | `sm:`  | 640px     |
| Medium     | `md:`  | 768px     |
| Large      | `lg:`  | 1024px    |
| XL         | `xl:`  | 1280px    |

### Example

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
	<!-- 1 column on mobile, 2 on tablet, 4 on desktop -->
</div>
```

---

## Transitions

Standard transition classes for interactive elements:

- Colors: `transition-colors`
- Opacity: `transition-opacity`
- Shadow: `transition-shadow`
- All: `transition-all`

Duration is handled by Tailwind defaults (150ms).

---

## Accessibility

1. Always include `focus:` states for interactive elements
2. Use semantic HTML (`<button>`, `<a>`, `<label>`)
3. Include `aria-label` for icon-only buttons
4. Maintain color contrast ratios (WCAG AA minimum)
5. Use `sr-only` class for screen-reader-only text when needed

```html
<!-- Focus state example -->
<button
	class="... focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
>
	Button
</button>

<!-- Screen reader text -->
<span class="sr-only">Close menu</span>
```

---

## File Organization

```
src/views/
├── layout.ejs           # Main layout with nav, footer
├── auth/
│   ├── login.ejs
│   └── register.ejs
├── dashboard/
│   ├── index.ejs
│   ├── settings.ejs
│   └── progress.ejs
├── errors/
│   └── 404.ejs
└── partials/            # Reusable components (future)
    ├── _alert.ejs
    └── _card.ejs
```
