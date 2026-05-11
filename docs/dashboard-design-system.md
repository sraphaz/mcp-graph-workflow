# Dashboard Design System

> `src/web/dashboard/src/components/system/`  
> Import via: `import { Card, StatusBadge, KpiTile, TimelineItem, EvidenceThumbnail, EmptyState } from "@/components/system";`

---

## `<Card>`

Standard card shell with border, rounded corners, and dark background.

**Props**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | ✓ | — | Card content |
| `className` | `string` | — | `""` | Extra Tailwind classes |

**Example**

```tsx
<Card>
  <h3>My Card</h3>
  <p>Content here</p>
</Card>

<Card className="col-span-2">
  Wide card
</Card>
```

---

## `<StatusBadge>`

Colored status chip. Pre-mapped colors for common status strings; falls back to slate for unknown values.

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `string` | ✓ | Status string (`"online"`, `"offline"`, `"done"`, `"in_progress"`, `"backlog"`, etc.) |
| `label` | `string` | — | Optional prefix label shown before status |

**Variants**

| Status | Color |
|--------|-------|
| `online`, `active`, `done`, `pass` | emerald (green) |
| `offline`, `blocked`, `fail`, `error` | red |
| `in_progress`, `running` | amber |
| `ready` | blue |
| `backlog`, `inactive`, `pending` | slate |

**Example**

```tsx
<StatusBadge status="online" />
<StatusBadge status="in_progress" label="CI" />
```

---

## `<KpiTile>`

Large metric number with a label and optional inline sparkline.

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string \| number` | ✓ | The metric value |
| `label` | `string` | ✓ | Descriptive label shown below the value |
| `sparkline` | `number[]` | — | Array of raw values rendered as a tiny SVG polyline |

**Example**

```tsx
<KpiTile value={42} label="Tasks done" />
<KpiTile value="93.5" label="Harness score" sparkline={[80, 85, 90, 93.5]} />
```

---

## `<TimelineItem>`

A single row in a vertical timeline. Composes into a `<ul>` list.

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✓ | Primary label / action name |
| `timestamp` | `string \| number` | — | ISO string or Unix ms; numbers are auto-formatted `HH:mm:ss.SSS` |
| `outcome` | `"pass" \| "fail" \| "error" \| "running" \| "pending"` | — | Outcome badge |
| `children` | `ReactNode` | — | Collapsible / expanded detail content |

**Example**

```tsx
<ul>
  <TimelineItem label="navigate" timestamp={1700000000000} outcome="pass" />
  <TimelineItem label="click" timestamp="12:00:01.234" outcome="running">
    <pre>{JSON.stringify({ selector: "#submit" }, null, 2)}</pre>
  </TimelineItem>
</ul>
```

---

## `<EvidenceThumbnail>`

Image thumbnail for screenshots / visual evidence. Used in Browser Tests and Agent Trail.

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Image URL |
| `alt` | `string` | ✓ | Accessible alt text |
| `label` | `string` | — | Optional caption below the image |

**Example**

```tsx
<EvidenceThumbnail src="/api/v1/journey/runs/abc/screenshots/0" alt="Step 1" label="Step 1 — Login" />
```

---

## `<EmptyState>`

Zero-data placeholder replacing ad-hoc empty `<div>` patterns across tabs.

**Props**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `string` | ✓ | Human-readable empty state message |
| `icon` | `string` | — | Emoji or Unicode character shown above the message |
| `action` | `{ label: string; onClick: () => void }` | — | Optional CTA button |

**Example**

```tsx
<EmptyState message="No journey maps yet" icon="🗺" action={{ label: "Import Journey Map", onClick: handleImport }} />
<EmptyState message="No backends detected" />
```
