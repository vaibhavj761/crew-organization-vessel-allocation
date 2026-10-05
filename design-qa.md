# Consolidated Vessel Allocation Export Design QA

## Reference review

- The earlier export separated the hierarchy from a dense vessel directory, making each team's allocation difficult to scan.
- Team ownership was not visually differentiated.
- Reporting layers, PICs, and vessels did not read as one connected operational unit.

## Implemented corrections

- Each Operations Manager now owns a distinct color-coded presentation column.
- Deputy sections, Crew Manager/PIC cards, and vessel names are nested inside their correct team column.
- Reporting relationships use a clean leadership chain and orthogonal team connectors.
- Crew Manager cards use consistent headers, vessel-count badges, and two-column vessel tags.
- Summary counters clearly show Operations Managers, deputies, Crew Managers, and vessels.
- Unassigned vessels remain visible in a dedicated neutral panel when present.
- The 1920 × 1080 SVG and 3840 × 2160 PNG formats remain unchanged.
- All hierarchy members and all vessel names remain present in the export.

## Verification

- Visual stress case: 1 director, 1 management layer, 4 Operations Managers, 8 deputies, 21 Crew Managers, and 143 vessels.
- No overlapping cards, detached allocations, or ambiguous reporting lines.
- No editing controls included.
- Long vessel names remain fitted within their allocation cards.
- Automated export, lint, test, and production-build checks pass.

**Final result: passed**
