# Ornament Components

Original geometric SVG ornaments for dyallo.se, created in the *discipline* of Kene (controlled repetition, single-color line work, restraint) but not traced from any existing Shipibo / Huni Kuin Kene patterns.

## Design Principles

- **Original work only** — No tracing or close imitation of published Kene art
- **Geometric primitives** — Lines, arcs, circles, rectangles only
- **Controlled repetition** — Patterns emerge from rhythm, not complexity
- **Single-color** — Uses `currentColor` to inherit text color from context
- **Restraint** — Negative space carries weight; omission is power

## Components

### StepPattern.astro

**Visual:** Ascending stepped lines with center peak, then descending (symmetrical).  
**Use:** Section divider in long-form posts, suggests progression/growth.  
**Size:** 120×40px  
**Symbolism:** Journey, ascent, return.

```astro
import StepPattern from '../components/ornament/StepPattern.astro';

<StepPattern />
```

### DotSequence.astro

**Visual:** Rhythmic dots growing to center, then shrinking (7 dots total).  
**Use:** Subtle pause marker, end-of-section breath.  
**Size:** 80×20px  
**Symbolism:** Punctuation, rhythm, inhalation/exhalation.

```astro
import DotSequence from '../components/ornament/DotSequence.astro';

<DotSequence />
```

### TriangleChain.astro

**Visual:** Linked triangles (upright/inverted alternating) with circular connector at center.  
**Use:** Between major H2 sections in essays, suggests connection/structure.  
**Size:** 140×30px  
**Symbolism:** Integration, structure, linked systems.

```astro
import TriangleChain from '../components/ornament/TriangleChain.astro';

<TriangleChain />
```

### ArcBracket.astro

**Visual:** Paired curved brackets with center dot.  
**Use:** Framing element for pull quotes or emphasis blocks.  
**Size:** 100×24px  
**Symbolism:** Containment, framing, closure.

```astro
import ArcBracket from '../components/ornament/ArcBracket.astro';

<ArcBracket />
```

### LineWeave.astro

**Visual:** Three horizontal lines with offset breaks, subtle vertical connectors.  
**Use:** Wide section divider, footer ornament.  
**Size:** 160×32px  
**Symbolism:** Weaving, integration, threads crossing.

```astro
import LineWeave from '../components/ornament/LineWeave.astro';

<LineWeave />
```

## Usage Guidelines

- **One ornament per long-form page maximum** — restraint is the discipline.
- **Between H2 sections only** — not after every paragraph.
- **Respects reading flow** — ornaments mark natural pauses, not every transition.
- **Color inherits from context** — uses `currentColor` so ornaments adapt to theme.

## Example in Blog Post

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import StepPattern from '../../components/ornament/StepPattern.astro';
import { getCollection, render } from 'astro:content';
// ...
---

<BaseLayout>
  <article>
    <h1>Essay Title</h1>
    
    <h2>First Section</h2>
    <p>Content...</p>

    <StepPattern />

    <h2>Second Section</h2>
    <p>More content...</p>
  </article>
</BaseLayout>
```

## Anti-Patterns (Do Not)

- ❌ Trace or close-imitate published Kene patterns
- ❌ Use ornaments as decorative filler (every section)
- ❌ Override `currentColor` with fixed colors (breaks dark mode)
- ❌ Add complexity for its own sake (keep geometric primitives simple)

---

**Attribution:** Original geometric work by Dennis Dyall for dyallo.se, 2026.  
**License:** Proprietary to dyallo.se — not for reuse without permission.
