# HAI Solutions Brand Manual

## Brand Overview
HAI Solutions is a human-centered AI consulting firm that empowers businesses through ethical, innovative artificial intelligence solutions. Our brand embodies professionalism, futurism, and human-centric values.

---

## Color Palette

### Primary Colors

#### Deep Slate Navy
- **Hex:** `#1E2A3A`
- **RGB:** `rgb(30, 42, 58)`
- **Usage:** Primary dark backgrounds, text, header gradients
- **Represents:** Trust, professionalism, depth

#### Royal Purple
- **Hex:** `#5D3FA3`
- **RGB:** `rgb(93, 63, 163)`
- **Usage:** Primary brand color, buttons, accents, gradient elements
- **Represents:** Innovation, creativity, intelligence

#### Mystic Purple
- **Hex:** `#7A4EB8`
- **RGB:** `rgb(122, 78, 184)`
- **Usage:** Secondary purple for gradients, hover states
- **Represents:** Transformation, technology

#### Teal Cyan
- **Hex:** `#3BC9B5`
- **RGB:** `rgb(59, 201, 181)`
- **Usage:** Accent color, highlights, "human-centered" emphasis
- **Represents:** Human connection, growth, balance

### Supporting Colors

#### Pure White
- **Hex:** `#FFFFFF`
- **RGB:** `rgb(255, 255, 255)`
- **Usage:** Text on dark backgrounds, card backgrounds in light mode
- **Represents:** Clarity, simplicity, transparency

#### Light Lavender
- **Hex:** `#C7A8E4`
- **RGB:** `rgb(199, 168, 228)`
- **Usage:** Light mode navbar gradients, subtle backgrounds
- **Represents:** Softness, approachability

---

## Typography

### Primary Font Family: **Space Grotesk**

**Why Space Grotesk?**
- Modern geometric sans-serif with a futuristic edge
- Excellent readability for body text and headings
- Professional yet distinctive character
- Free and open-source (Google Fonts)
- Perfect balance between technical precision and human warmth

**Implementation:**
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

body {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Alternative Font: **Inter**

**Why Inter?**
- Industry-standard for modern tech companies
- Exceptional legibility at all sizes
- Optimized for digital screens
- Professional and trustworthy
- Free and open-source (Google Fonts)

**Implementation:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

### Font Weight Guidelines

- **Light (300):** Subtle captions, metadata
- **Regular (400):** Body text, descriptions
- **Medium (500):** Navigation links, subheadings
- **Semi-Bold (600):** Card titles, section subheadings
- **Bold (700):** Main headings, CTAs, emphasis
- **Extra Bold (800):** Hero titles (if using Inter)

---

## Gradient Combinations

### Primary Gradient (Dark Mode Header)
```css
background: linear-gradient(135deg, #1E2A3A 0%, #5D3FA3 50%, #1E2A3A 100%);
```

### Accent Gradient (Buttons, Highlights)
```css
background: linear-gradient(135deg, #5D3FA3, #7A4EB8, #3BC9B5);
```

### Scrolled Navbar Gradient
```css
background-image: linear-gradient(to top right, #5D3FA3, #7A4EB8, #3BC9B5);
```

### Text Shimmer Effect
```css
background: linear-gradient(135deg, #ffffff 0%, #3BC9B5 50%, #ffffff 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## Logo Usage

### Logo Files
- **Primary Logo:** `hai-logo.webp`
- **Light Mode:** `hai-logo.webp`
- **Dark Mode:** `hai-logo.webp`
- **Infinity Sign:** `infinity-sign-hai-removebg-preview.png`

### Logo Sizing
- **Desktop:** 180px width, 60px height (or aspect ratio equivalent)
- **Tablet:** 140px width
- **Mobile:** 140px width

### Logo Clear Space
Maintain minimum clear space of 20px around the logo on all sides.

---

## Button Styles

### Primary CTA Button
- **Background:** `#5D3FA3` to `#3BC9B5` gradient
- **Text:** `#FFFFFF`, uppercase, 1rem, 600 weight
- **Border Radius:** 30px (pill shape)
- **Padding:** 0.875rem 2.5rem
- **Box Shadow:** `0 4px 15px rgba(93, 63, 163, 0.4)`
- **Animation:** Pulsing glow effect (2s interval)

### Hover State
- **Transform:** `scale(1.05)` + `translateY(-2px)`
- **Box Shadow:** Enhanced glow with multiple layers

---

## Animation Guidelines

### Pulse Glow (Primary CTAs)
- **Duration:** 2 seconds
- **Easing:** ease-in-out
- **Effect:** Subtle scale and shadow expansion

### Shimmer Text
- **Duration:** 3 seconds
- **Easing:** ease-in-out
- **Effect:** Gradient position shift

### Floating Elements
- **Duration:** 3 seconds
- **Easing:** ease-in-out
- **Effect:** Vertical translation (-10px)

### Fade In
- **Duration:** 0.8 seconds
- **Easing:** forwards
- **Effect:** Opacity 0→1, translateY 20px→0

---

## Spacing System

### Margin/Padding Scale
- **XS:** 0.5rem (8px)
- **SM:** 1rem (16px)
- **MD:** 1.5rem (24px)
- **LG:** 2rem (32px)
- **XL:** 3rem (48px)
- **2XL:** 4rem (64px)
- **3XL:** 6rem (96px)

---

## Accessibility Guidelines

### Color Contrast
- All text maintains WCAG AA compliance (4.5:1 for body text)
- Primary purple (#5D3FA3) on white: 7.2:1 ✓
- White on deep slate (#1E2A3A): 14.8:1 ✓
- Teal (#3BC9B5) used for accents only, not primary text

### Focus States
- Visible focus indicators on all interactive elements
- Minimum 2px outline with high contrast color

### Text Sizing
- Base font size: 16px minimum
- Line height: 1.5-1.8 for optimal readability
- Heading hierarchy clearly defined

---

## Theme Modes

### Dark Mode (Primary)
- **Background:** `#1E2A3A` with purple gradients
- **Text:** `#FFFFFF`
- **Accents:** `#3BC9B5` and `#5D3FA3`

### Light Mode
- **Background:** `#FFFFFF`
- **Text:** `#1E2A3A`
- **Accents:** `#5D3FA3` and `#3BC9B5`
- **Header:** Maintains dark gradient for premium look

---

## Brand Voice & Tone

### Professional
Clear, confident, expertise-driven

### Futuristic
Forward-thinking, innovative, cutting-edge

### Human-Centered
Empathetic, accessible, partnership-focused

### Example Headlines
- "Empowering your people through human-centered AI"
- "Transform your business with ethical AI solutions"
- "Where innovation meets humanity"

---

## Do's and Don'ts

### Do's ✓
- Use gradients to add depth and dimension
- Maintain consistent spacing and alignment
- Emphasize "human-centered" in brand messaging
- Use animations subtly to enhance UX
- Keep text readable with proper contrast

### Don'ts ✗
- Don't use more than 3 colors in a single component
- Don't over-animate (keep animations under 3s)
- Don't use body text smaller than 14px
- Don't stretch or distort the logo
- Don't use pure black (#000000) - use #1E2A3A instead

---

## Contact
For brand guidelines questions or assets, contact the HAI Solutions design team.

**Last Updated:** December 27, 2025
**Version:** 1.0

