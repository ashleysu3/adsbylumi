

# Simplify Creative Studio Loading Transition

## What's Changing

Remove the "TV iris" clip-path animation entirely. Replace it with a simple, clean fade-in transition that feels natural and calming -- no fancy effects, just a smooth appearance.

## Approach

Strip out all `clip-path` / `circle()` animation logic from `CreativeStudio.tsx` and the `@keyframes iris-open` from `index.css`. Replace with a straightforward `opacity + translateY` fade-in using Framer Motion that takes ~0.4s -- fast enough to not feel sluggish, slow enough to feel intentional.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/CreativeStudio.tsx` | Remove all `motion.div` wrappers with `clipPath` animations. Replace with a simple `opacity: 0 -> 1` and `y: 12 -> 0` fade-in on the main content container. Apply to both the empty state and the workspace state sections. |
| `src/index.css` | Remove the `@keyframes iris-open` definition since it's no longer used. |

## Technical Details

### New Animation (CreativeStudio.tsx)

Replace the two `motion.div` wrappers (empty state and workspace state) from:

```tsx
<motion.div
  initial={{ clipPath: "circle(0% at 50% 40%)" }}
  animate={{ clipPath: "circle(150% at 50% 40%)" }}
  transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
>
```

To:

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: "easeOut" }}
>
```

This gives a gentle "rise into view" feel without any visual gimmicks. The content simply fades in and slides up slightly -- clean, fast, calming.

### CSS Cleanup (index.css)

Remove the `@keyframes iris-open` block that was added for the circle animation since it's no longer referenced anywhere.

