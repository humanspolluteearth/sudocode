# Mobile and tablet fidelity pass: decisions

Sources: `reference/prototype/design/Mobile.dc.html` and `Tablet.dc.html`. Screenshots: `scripts/ui-mobile-shots.mjs`.
PRs: #138 (script, Q59), #139-#146, and the gutter PR (#147). No item failed twice.

- Layout thresholds: phone below 700px, tablet 700-1100px, desktop above 1100px (`useLayout()`).
- Touch targets: 44px on phones, 40px on tablets. File tabs keep the design's 34/30px height with 44/40px width.
- The language name in the status bar is hidden on phones and tablets so the bar fits one row.
- The Guide view on phones is the Quick reference tab, with a link to the full guide. Persistence of the editor across views was checked; no fix needed.
- Tablet: editor and console beside a 380px side panel, 52px toolbar, no bottom nav. The key bar shows on `pointer: coarse`.
- Older tests at 834px that assumed a view switcher were limited to 390px or phones (listed in #146). Tablet e2e baselines were regenerated in #146; mobile baselines are unchanged.
- The gutter on compact layouts is content-sized (min 4 digits) so 4-digit line numbers fit at 150% zoom.
- Quote style: not changed in the checker; see Q59 in QUESTIONS.md.
