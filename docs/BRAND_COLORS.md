# WeighTogether Brand Colors

Updated to match the logo design with teal, turquoise, and lime green colors.

## Brand Color Palette

### Primary Colors (Teal/Turquoise)

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary** | `#14b8a6` (Teal-500) | Main brand color - buttons, links, CTAs |
| **Primary Deep** | `#0d9488` (Teal-600) | Hover states, emphasis |
| **Primary Dark** | `#0f766e` (Teal-700) | Dark mode backgrounds, deep emphasis |
| **Cyan** | `#06b6d4` (Cyan-500) | Alternative primary, gradients |
| **Light** | `#5eead4` (Teal-300) | Light accents, highlights |

### Secondary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **Secondary** | `#84cc16` (Lime-500) | Secondary accent color, success states |
| **Success** | `#10b981` (Emerald-500) | Success messages, positive actions |
| **Caution** | `#f59e0b` (Amber-500) | Warning states |
| **Alert** | `#ef4444` (Red-500) | Error states, destructive actions |
| **Milestone** | `#a78bfa` (Purple-400) | Achievement badges |

## CSS Variables

```css
--color-watch-primary: #14b8a6;      /* Teal-500 */
--color-watch-primary-deep: #0d9488; /* Teal-600 */
--color-watch-primary-dark: #0f766e; /* Teal-700 */
--color-watch-secondary: #84cc16;    /* Lime-500 */
--color-watch-light: #5eead4;        /* Teal-300 */
--color-watch-cyan: #06b6d4;         /* Cyan-500 */
```

## Tailwind Utility Classes

### Background Colors
- `.bg-brand` - Primary teal background
- `.bg-brand-deep` - Deeper teal for hover states
- `.bg-brand-dark` - Dark teal variant
- `.bg-brand-secondary` - Lime green secondary
- `.bg-brand-light` - Light teal accent
- `.bg-brand-gradient` - Teal to cyan gradient
- `.bg-brand-gradient-secondary` - Lime to teal gradient

### Text Colors
- `.text-brand` - Primary teal text
- `.text-brand-deep` - Deeper teal text
- `.text-brand-secondary` - Lime green text

### Border Colors
- `.border-brand` - Primary teal border

### Standard Tailwind Colors
For more granular control, use standard Tailwind teal colors:
- `teal-50` through `teal-950` - Full teal palette
- `lime-50` through `lime-950` - Full lime palette
- `cyan-50` through `cyan-950` - Full cyan palette

## Usage Examples

### Primary Button
```html
<button class="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded">
  Click me
</button>
```

### Brand Gradient Button
```html
<button class="bg-brand-gradient text-white px-6 py-3 rounded-lg">
  Get Started
</button>
```

### Link with Brand Color
```html
<a href="#" class="text-teal-600 hover:text-teal-700">
  Learn more
</a>
```

### Input Focus Ring
```html
<input class="border border-gray-300 focus:ring-2 focus:ring-teal-500 rounded">
```

## Dark Mode

The brand colors work well in dark mode:
- Use lighter teal shades (teal-400, teal-300) for text in dark mode
- Use darker teal shades (teal-700, teal-800) for backgrounds in dark mode
- The hero gradient automatically adjusts for dark mode

## Color Migration

All instances of blue colors have been replaced with teal:
- `bg-blue-500` → `bg-teal-500`
- `bg-blue-600` → `bg-teal-600`
- `bg-blue-700` → `bg-teal-700`
- `text-blue-500` → `text-teal-500`
- `text-blue-600` → `text-teal-600`
- `ring-blue-500` → `ring-teal-500`

## Design Principles

1. **Primary Actions** - Use teal-500 or the brand gradient
2. **Secondary Actions** - Use lime-500 or teal-400
3. **Success States** - Use emerald-500 (green)
4. **Hover States** - Darken by one shade (teal-500 → teal-600)
5. **Active/Pressed** - Darken by two shades (teal-500 → teal-700)
6. **Focus Rings** - Always use teal-500 for consistency
7. **Gradients** - Combine teal and cyan for dynamic CTAs

## Logo Reference

Colors were extracted from the WeighTogether logo (`public/images/weightogether_logo.png`):
- Left figure: Teal/turquoise blue
- Right figure and "W": Lime/grass green
- Overall palette: Friendly, energetic, health-focused

---

**Last Updated**: 2025-12-24
