---
name: Covert Operations Grid
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#ffb4ab'
  on-secondary: '#690005'
  secondary-container: '#bb0112'
  on-secondary-container: '#ffc8c1'
  tertiary: '#eec200'
  on-tertiary: '#3c2f00'
  tertiary-container: '#cea700'
  on-tertiary-container: '#4e3d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000b'
  tertiary-fixed: '#ffe083'
  tertiary-fixed-dim: '#eec200'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#574500'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 40px
  card-gap: 12px
---

## Brand & Style

The design system is built on a high-fidelity **Modern Espionage** aesthetic, blending the precision of a digital intelligence terminal with the tactile grit of a Cold War dossier. It targets a competitive gaming audience that values clarity, immersion, and atmospheric tension. 

The style utilizes a **Cyber-Brutalist** foundation: heavy borders, monospaced accents, and high-contrast color blocks are softened by modern glassmorphism and subtle textures. The interface should feel like a high-stakes command center—urgent, secretive, and highly functional. 

Key visual drivers include:
- **Atmospheric Depth:** Deep, layered backgrounds that suggest a dark room illuminated only by screens.
- **Intellectual Grit:** Use of scanned-document textures and terminal-style UI overlays.
- **Tactile Feedback:** Cards and buttons should feel like physical toggle switches or heavy-duty field equipment.

## Colors

The color palette is functionally driven to distinguish team ownership and game states instantly. 

- **Primary (Blue Team):** #2563EB — Used for Blue Team cards, scores, and turn indicators. Evokes stability and cold calculation.
- **Secondary (Red Team):** #DC2626 — Used for Red Team cards and UI elements. Evokes urgency and aggressive action.
- **Background (Deep Slate):** #0F172A — The "void" in which the intel exists. Secondary surfaces use #1E293B for depth.
- **Accent (Gold/Caution):** #FACC15 — Reserved for "The Assassin," high-priority alerts, or the current active turn glow.
- **Neutral/Innocent:** #94A3B8 — A desaturated, dusty grey for "Bystander" cards and inactive interface chrome.

## Typography

This design system uses a dual-type approach to balance theme and legibility.

1.  **Headlines & Labels (JetBrains Mono):** This monospaced font mimics technical readouts and "classified" typewritten documents. It is used for team names, card words, and status labels to reinforce the technical/espionage theme.
2.  **Body & UI (Inter):** A clean, high-performance sans-serif used for instructional text, chat logs, and settings to ensure maximum readability during fast-paced gameplay.

**Formatting Note:** All `label` roles should be rendered in uppercase to simulate military-style categorization.

## Layout & Spacing

The layout follows a **Fixed-Focus Grid** model. The primary game board (the 5x5 grid) remains the central focal point, while auxiliary intel (scores, turn history, and cluemaster controls) occupies the periphery.

- **Desktop:** A 12-column system where the central 8 columns house the card grid. The remaining columns are used for team dossiers (Red vs. Blue) on either side.
- **Mobile:** A single-column vertical stack. The card grid scales to fill the width (2-column layout for cards), with score indicators pinned to a top-persistent "Command Bar."
- **Rhythm:** An 8px base unit is used for component internal padding, while a 12px `card-gap` ensures the grid feels tight and "contained" like a briefcase of documents.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layering** and **High-Contrast Glows** rather than traditional soft shadows.

- **Base Layer:** The darkest shade (#0F172A).
- **Surface Layer:** Cards and panels use #1E293B with a subtle 1px border (#334155).
- **Active Elevation:** When a card is hovered or selected, it does not rise; instead, it gains an inner "scanning" glow of the team's primary color and a 2px outer border.
- **The Assassin Card:** Uses a distinct "Hazard" texture—subtle diagonal stripes in the background to indicate danger without relying solely on color.
- **Backdrop Blur:** Modals and overlays use a heavy blur (20px) with a 40% opacity black tint to focus the user entirely on the "top secret" intel being presented.

## Shapes

The design system utilizes **Soft-Industrial** geometry. 

Elements are mostly rectangular with very small corner radii (4px) to suggest the clipped edges of ID cards or metal equipment. 
- **Cards:** 4px radius (Soft).
- **Buttons:** 2px radius or completely sharp to maintain a "utilitarian" feel.
- **Status Pills:** Pill-shaped (fully rounded) only for status indicators that need to stand out from the rigid rectangular grid, such as "Active Turn" or "Connected."

## Components

### Word Cards
The core component. Each card features a grain texture.
- **Default:** Slate background, centered JetBrains Mono text. 
- **Revealed:** The card flips or transitions to full color (Blue/Red/Tan/Black). Use a "Top Secret" or "REDACTED" stamp overlay for revealed bystanders.
- **Assassin:** Solid black card with a Gold/Yellow #FACC15 border and a skull or "X" icon.

### Team Dossiers (Scoreboards)
Vertical panels on the screen edges. They feature a progress bar indicating how many agents are left to find. The active team's dossier should have a "pulsing" border to indicate it is their turn.

### The Clue Input
A persistent input field at the bottom for the Spymaster. It uses a monospaced font and a "Transmit" button instead of "Submit." The styling should mimic a physical terminal input line.

### Action Buttons
- **Primary:** High-contrast background with a "glitch" or "scanline" hover effect.
- **Secondary:** Transparent with a 1px border ("Ghost" style).
- **Hazard:** For "End Turn" or "Report," use a secondary red or yellow outline.

### Status Indicators
Small, flickering LED-style dots (circles) next to player names in the lobby to indicate "Ready" or "Online" status, reinforcing the hardware aesthetic.