# CafeQR

Multi-cafe QR ordering demo.

Start the API project under cafeqr-api, then Expo web in cafeqr.
Guest paths: /c/<slug>/t/<table>. Legacy /t/<n> redirects to the default demo cafe.
Owner and staff screens take ?slug=. QR codes use cafe-specific paths.
Hybrid: prefers live API, falls back to local seed.

Examples: /c/velvet-bean/t/04 and /c/spice-lane/t/03
Demo access code: 1234 for owner and staff.
