# Lasse Meerburg — portfolio redesign concept

A concept redesign of [lassemeerburg.squarespace.com](https://lassemeerburg.squarespace.com/) with a visual style inspired by **Persona 3 Reload**: deep blues, slanted heavy type, tarot-style project cards, dialogue boxes and a "Dark Hour" theme toggle.

All content (text, project write-ups, images, testimonials) is from the existing site. Images are loaded from the Squarespace CDN.

## Pages

| Page | Idea |
| --- | --- |
| `index.html` | Main-menu hero with a cut-out of Lasse, intro dialogue with a speaking portrait and link choices, projects (newest first), testimonial carousel |
| `projects.html` | Project list with live preview, filters (released games, Unreal Engine, system design) and sorting (newest, oldest, team size) |
| `about.html` | Profile, team sizes, skills, tools and all testimonials |
| `cv.html` | Curriculum Vitae timeline with a sticky calendar that points at the entry you're reading |
| `contact.html` | Phone-chat contact page |
| `projects/*.html` | One page per project: at-a-glance box (role / challenge / what I did / result), summary, producer work, chapter list, lightbox gallery, takeaways, newer/older links, per-project accent colour |
| `velvet.html` | Hidden room (Konami code ↑↑↓↓←→←→BA) |

## Interactions

- **Esc** opens the full-screen menu (arrow keys + Enter). It also holds the **Extras**: the green *Dark Hour* theme and optional synthesised sound effects (both off by default)
- **Controller support**: browse with an Xbox or PlayStation pad (Gamepad API), with on-screen button prompts
- The header hides while you scroll down and comes back when you scroll up or move the mouse to the top

## Motion

Kept deliberately calm after feedback: page wipes, entrance reveals, hover and click feedback, a "Let's team up!" finish screen on the Contact buttons, and a very subtle WebGL water background (CSS fallback when WebGL, motion or data saving is off). Nothing loops or drifts on its own, and everything respects `prefers-reduced-motion`.

## Under the hood

- No build step, no framework: `assets/css/style.css` and `assets/js/site.js`
- Each feature boots independently, so one failure can't blank the page
- Images carry their intrinsic size (no layout shift); project heroes use responsive `srcset`
- Link previews (Open Graph) for every page in `assets/img/og/`
- Cookie-free visit stats via [GoatCounter](https://www.goatcounter.com/) (`lmeerburg`)

## Running locally

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8000
```

---

Fan-made design concept. Not affiliated with or endorsed by ATLUS or SEGA. Persona is a trademark of ATLUS. No game assets are used; all shapes, icons and effects are original CSS/SVG.
