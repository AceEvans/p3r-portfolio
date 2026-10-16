# Lasse Meerburg — portfolio redesign concept

A concept redesign of [lassemeerburg.squarespace.com](https://lassemeerburg.squarespace.com/) with a visual style inspired by **Persona 3 Reload**: deep blues, slanted heavy type, tarot-style project cards, dialogue boxes and a "Dark Hour" theme toggle.

All content (text, project write-ups, images, testimonials) is from the existing site. Images are loaded from the Squarespace CDN.

## Pages

| Page | Idea |
| --- | --- |
| `index.html` | Title screen hero, dialogue intro with choices, project rows with Arcana cards, testimonial carousel |
| `projects.html` | Social Link-style list with a live preview panel |
| `about.html` | Status screen: parameters, team-size bars, skills, equipment, full testimonial backlog |
| `cv.html` | CV as a calendar timeline, with a link to the PDF |
| `contact.html` | In-game phone chat |
| `projects/*.html` | One page per project, with summary, producer work, lightbox gallery and a "Rank up" takeaways box |

## Interactions

- **Esc** opens the full-screen pause-style menu (arrow keys + Enter to navigate)
- **Dark Hour** button switches the palette with a circular reveal and a clock stamp (it switches on automatically between 00:00 and 01:00 unless you have picked a theme). Link straight to it with `?theme=dark-hour`
- **SFX** button turns on synthesised UI sounds (Web Audio, no audio files; off by default)
- Live date, moon phase and time of day in the header

## Motion & feedback

- First-visit intro and labelled page-wipe transitions
- Headings cascade in letter by letter; project titles glitch on hover
- Arcana cards deal in with a flip from a tarot back, float while idle, tilt and catch a holographic glare under the cursor
- Lists, chips and stats stagger in; numbers count up; bars fill and glint
- Images reveal with a sweeping block wipe; the lightbox zooms out of the thumbnail
- Click splashes, magnetic buttons with a shine sweep and press squash
- Scroll progress bar, auto-hiding header, back-to-top button, scroll and mouse parallax
- "Rank up" sparkle burst on each project's takeaways; chat bubbles pop in on the contact phone
- Everything respects `prefers-reduced-motion`

## Running locally

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8000
```

---

Fan-made design concept. Not affiliated with or endorsed by ATLUS or SEGA. Persona is a trademark of ATLUS. No game assets are used; all shapes, icons and effects are original CSS/SVG.
