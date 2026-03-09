

## Client Approval Portal — Implementation Plan

This is a large feature with 7 distinct deliverables: 2 database tables, 3 edge functions, 1 public page, and frontend integration (share dialog + activity feed).

---

### 1. Database Migration

**Table: `client_portals`**
- Columns as specified (id, workspace_id, brand_id, created_by, access_code_hash, portal_name, client_name, status, agency_branding, items_included, expires_at, created_at)
- Foreign keys to campaign_workspaces, brands
- RLS: owner (created_by = auth.uid()) can SELECT/INSERT/UPDATE/DELETE
- Security definer function `validate_portal_access(portal_id uuid)` for public lookups (used by edge functions only)

**Table: `client_portal_activity`**
- Columns as specified (id, portal_id, production_item_id, action, comment, client_name, created_at)
- Foreign key to client_portals
- RLS: owner can SELECT via join to client_portals.created_by; no direct public INSERT (service role only)
- Use validation trigger instead of CHECK constraint for action values

---

### 2. Edge Functions

**`client-portal-auth`** (verify_jwt = false)
- Accepts `{ portalId, accessCode }`
- Uses service role to fetch portal by ID
- SHA-256 hash comparison for access code
- On success: returns portal metadata + production items from campaign_workspaces (fetched via workspace_id)
- On failure: 401

**`client-portal-actions`** (verify_jwt = false)
- Accepts `{ portalId, accessCode, action, productionItemId, comment?, clientName? }`
- Re-validates access code (stateless)
- Inserts into `client_portal_activity`
- Updates `campaign_workspaces.production_items` JSONB — finds matching item by ID, sets `approval_status` and `approval_comment`
- Fire-and-forget call to `send-portal-notification`
- Returns `{ success: true }`

**`send-portal-notification`** (verify_jwt = false)
- Accepts portal context
- Fetches creator email via service role
- Sends email via Resend (matching existing pattern from `send-welcome-email`)
- Wrapped in try/catch, never throws

---

### 3. Client Portal Page

**New file: `src/pages/ClientPortal.tsx`**

Public route at `/client-portal/:portalId` — no DashboardLayout, no sidebar.

**Screen 1 — Password Gate:**
- Clean centered layout with agency logo/name
- Portal name heading
- Text input for access code (styled as individual character boxes using existing `input-otp` package)
- Calls `client-portal-auth` on submit
- Stores `{ portalId, accessCode }` in sessionStorage on success

**Screen 2 — Portal Content:**
- Header with agency branding (logo or name, optional "Powered by LUMI" badge)
- Progress bar showing approved count / total
- Items grouped by format (Talking Head, B-Roll, Graphic, Copy) with section headers
- Each item card shows format-specific content (hook, script_lines, delivery_style, text_overlays, etc.)
- "Approve" button — optimistic UI update, calls `client-portal-actions`
- "Request Changes" button — expands textarea for optional comment, then submits
- 100% approved state: confetti + banner
- Footer note about file handoff via Slack/email

---

### 4. Share with Client Dialog

Added to `ProductionManager.tsx`:
- "Share with Client" button (Share2 icon), visible when productionItems.length > 0
- Two-step dialog:
  - **Step 1 — Configure:** Portal name (pre-filled), client name, access code (with generate button), item selection checklist, collapsible branding section (agency name, logo URL, primary color, powered-by toggle)
  - **Step 2 — Share:** Shows generated link + access code with copy buttons, done button
- Hashes access code via SubtleCrypto before inserting into `client_portals`

---

### 5. Activity Feed

In `ProductionManager.tsx`, below the Share button:
- If a portal exists for this workspace, show an "Client Activity" card
- Fetches from `client_portal_activity` ordered by created_at desc
- Each row: action icon + item name + relative timestamp + optional comment
- Polls every 30 seconds via setInterval
- Empty state message when no activity

---

### 6. Approval Status Badges on Production Items

Update `CreativeChecklistCard.tsx` to accept and display `approval_status`:
- `approved` → green badge
- `changes_requested` → amber badge
- No field → no badge (clean default)

Read from `production_items` JSONB (fields added by edge function, no schema migration needed).

---

### 7. Routing

Add to `App.tsx`:
```
<Route path="/client-portal/:portalId" element={<ClientPortal />} />
```
Placed outside any auth guard, renders with zero app chrome.

---

### Implementation Order

1. Database migration (both tables + RLS + security definer function)
2. Edge functions (client-portal-auth, client-portal-actions, send-portal-notification)
3. ClientPortal.tsx page + route in App.tsx
4. Share with Client dialog in ProductionManager
5. Activity feed in ProductionManager
6. Approval status badges on CreativeChecklistCard

