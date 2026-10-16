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
- **Dark Hour** button switches the palette (it switches on automatically between 00:00 and 01:00 unless you have picked a theme)
- Live date, moon phase and time of day in the header
- Page-wipe transitions, typewriter dialogue, card tilt, image lightbox
- Respects `prefers-reduced-motion`

## Running locally

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8000
```

---

Fan-made design concept. Not affiliated with or endorsed by ATLUS or SEGA. Persona is a trademark of ATLUS. No game assets are used; all shapes, icons and effects are original CSS/SVG.
