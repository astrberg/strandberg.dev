---
name: jekyll-site
description: Guidelines for managing Jekyll configurations, Liquid layouts, SEO plugins, responsive layout templates, and vanilla CSS design tokens.
---

# Skill: Jekyll Static Site & CSS Theming

This skill governs static site compilation, layouts, templating, and CSS style sheets across the entire portfolio site.

## Architecture Overview

*   **Jekyll Configuration (`_config.yml`)**: Controls global variables, SEO metadata overrides, sitemap generations, and plugins (`jekyll-seo-tag`, `jekyll-sitemap`).
*   **Jekyll Layouts (`_layouts/`)**:
    *   `resume.html`: Wraps pages in print-friendly, centered dark-theme containers, imports `resume.css`, and displays automated last-updated footers.
    *   `me.html`: A minimalist layout wrapper for custom media sub-pages.
*   **CSS Design System (`assets/css/`)**:
    *   `resume.css`: Employs CSS custom properties/variables for dark mode aesthetics, clean list elements, links with transitions, mobile responsiveness, and custom black-and-white print styles (`@media print`).
    *   `game.css`: Powers the complex HUD placement, overlays, borders, font sizing, and WoW retro console layout for the 3D world.
    *   `login.css`: Styles the WoW-inspired classic login portals, animated loading bar containers, and realm status frames.

## Key Development Rules

1.  **Strict Layout Hierarchies**: Always use Jekyll's frontmatter to link markdown files to their corresponding layouts (e.g., `layout: resume`). Do not write redundant `<head>` tags in Markdown files.
2.  **SEO Integrity**: Maintain the `{% seo %}` liquid block in all page layouts. Any page metadata changes should be declared in the file's YAML frontmatter (like `title`, `description`, `permalink`) rather than hardcoded on layouts.
3.  **Aesthetics & Theming**:
    *   Use the predefined CSS variables from the design tokens system (`--bg`, `--surface`, `--accent`, etc.) to keep layout colors consistent.
    *   Do not inject ad-hoc inline styles. Use structural utility classes or specific selector hierarchies.
4.  **Print Responsiveness**: Ensure that any content under the `resume` layout maintains clean print rules inside `@media print` blocks (e.g., hiding navigation banners/print buttons, forcing a white background with dark text, and keeping content readable when printed to PDF).
5.  **Liquid Formatting**: Keep liquid script tags simple. Clean up template build files (`_site/`) by ensuring compile tasks complete without syntax issues in loops or conditional blocks.
