# Lasse Meerburg — portfolio redesign concept

A concept redesign of [lassemeerburg.squarespace.com](https://lassemeerburg.squarespace.com/) with a visual style inspired by **Persona 3 Reload**: deep blues, slanted heavy type, tarot-style project cards, dialogue boxes and a "Dark Hour" theme toggle.

All content (text, project write-ups, images, testimonials) is from the existing site. Images are loaded from the Squarespace CDN.

## Pages

| Page | Idea |
| --- | --- |
| `index.html` | Main-menu hero with a cut-out of Lasse, dialogue intro with a speaking portrait and choices, project rows with Arcana cards, testimonial carousel |
| `projects.html` | Compendium: Social Link list with live preview, filters (role, engine) and sorting (Arcana №, newest, team size) |
| `about.html` | Status screen: parameters, team-size bars, skills, equipment, full testimonial backlog |
| `cv.html` | Curriculum Vitae as a timeline with a sticky calendar that "rewinds" through the dates as you scroll |
| `contact.html` | In-game phone chat |
| `projects/*.html` | One page per project: quest log (role / challenge / what I did / result), summary, producer work, chapter list, lightbox gallery, "Rank up" takeaways, per-project accent colour |
| `velvet.html` | Hidden room (Konami code ↑↑↓↓←→←→BA) with off-duty facts and the trophy compendium |

## Interactions

- **Esc** opens the full-screen pause-style menu (arrow keys + Enter to navigate)
- **Dark Hour** button switches the palette with a circular reveal and a clock stamp (it switches on automatically between 00:00 and 01:00 unless you have picked a theme). Link straight to it with `?theme=dark-hour`
- **SFX** button turns on synthesised UI sounds (Web Audio, no audio files; off by default)
- **Controller support**: browse with an Xbox or PlayStation pad (Gamepad API), with on-screen button prompts
- **Trophies**: 14 achievements for exploring, saved per visitor; see them from the menu or the footer
- Live date, moon phase and time of day in the header

## Motion & feedback

- Live WebGL water-caustics background (falls back to CSS when WebGL, motion or data saving is off)
- First-visit intro and labelled page wipes
- "Let's team up!" finish screen on the Contact buttons
- Headings cascade in letter by letter; project titles glitch on hover
- Arcana cards deal in with a flip from a tarot back, float while idle, tilt and catch a holographic glare under the cursor
- Lists, chips and stats stagger in; numbers count up; bars fill and glint
- Images reveal with a sweeping block wipe; the lightbox zooms out of the thumbnail
- Click splashes, magnetic buttons with a shine sweep and press squash
- Scroll progress bar, auto-hiding header, back-to-top button, scroll and mouse parallax
- Everything respects `prefers-reduced-motion`

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
