# Landing site (static)

Marketing front door: `index.html` (landing + pricing + demo CTA), `terms.html`, `privacy.html`, `legal.css`.
No build step — deploy the folder as-is to GitHub Pages, Netlify, Vercel, or any static host.

## Before publishing — checklist

1. **Booking link**: search `BOOKING_URL` in `index.html` (3 spots) and replace the `mailto:` href
   with your Calendly/booking URL. The mailto works as a fallback until then.
2. **Contact email**: search `CONTACT_EMAIL` / `elavalasrinivasreddy@gmail.com` and switch to a
   domain email when available.
3. **Legal pages**: `terms.html` and `privacy.html` are **drafts with [PLACEHOLDERS]** —
   fill entity name, address, grievance officer, dates, sub-processor table; get lawyer review;
   remove the orange draft banner from both files.
4. Update the visitor-analytics line in `privacy.html` §2 to match whatever analytics (if any)
   you add to this site.

## Local preview

```bash
cd landing && python3 -m http.server 8080
# open http://localhost:8080
```
