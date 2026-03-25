

## Problem

The ad preview's Stories and Reels tabs use `object-cover` on all media, which crops square (1:1) images to fill the 9:16 frame -- cutting off content. In reality, Meta Ads Manager does NOT crop square images for Stories/Reels. Instead, it centers the square image and adds a gradient color fill above and below. The current preview is misleading users into thinking their content is being cropped when it is not.

The upload-to-Meta edge function sends the raw asset file -- Meta itself handles placement adaptation. So the creative is **not** getting cut off in Ads Manager.

## Plan

### 1. Detect asset aspect ratio and adapt rendering

In both `AdPreviewModal.tsx` and `AdPreview.tsx`, when rendering media inside a 9:16 container (Stories/Reels):

- Use an `onLoad` handler on `<img>` to detect if the image is square (or close to 1:1)
- If the image is **not** 9:16-ish, switch from `object-cover` to `object-contain` and add a gradient background behind it (mimicking Meta's behavior)
- For videos, use `onLoadedMetadata` to read `videoWidth`/`videoHeight` and apply the same logic

The gradient will sample from the image's dominant edge colors using a CSS approach: render the image behind itself at full-bleed with a heavy blur, then overlay the actual image centered -- this is how Meta does it.

### 2. Update `renderMedia` in AdPreviewModal.tsx

- Add state: `mediaAspect: number | null`
- In the `renderMedia` function, wrap media in a container that:
  - For **9:16 containers** (Stories/Reels): if `mediaAspect` is close to 1:1, render the image with `object-contain` over a blurred copy of itself as background
  - For **1:1 containers** (Feed/Instagram): keep `object-cover` as-is (this is correct)
- Accept a `placement` parameter (`"feed" | "vertical"`) to control behavior

### 3. Update `AdPreview.tsx` Stories tab

Apply the same logic: detect square assets and render them centered with gradient/blur padding instead of cropping.

### 4. Files to modify

- `src/components/creative/AdPreviewModal.tsx` -- update `renderMedia`, add aspect detection state
- `src/components/AdPreview.tsx` -- update Stories tab media rendering

### Technical detail

```text
9:16 container with square image (Meta-style):

┌─────────────┐
│ blurred bg   │  ← gradient/blur fill
│  ┌────────┐  │
│  │ square │  │  ← actual image, centered
│  │ image  │  │
│  └────────┘  │
│ blurred bg   │  ← gradient/blur fill
└─────────────┘
```

The blurred background is achieved by rendering the same image behind with `object-cover` + `blur(20px)` + slight scale-up, then the real image on top with `object-contain`. This closely matches Meta's actual rendering.

