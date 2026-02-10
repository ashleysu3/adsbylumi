

# Admin Power-Up: Role Management, User Archiving, and Streamlined Actions

## What We're Building

Three major improvements to your admin experience:

1. **Role Management** -- Grant/revoke admin access and add a new "moderator" role with limited permissions
2. **User Archiving** -- Soft-archive users to declutter the admin view without destroying data, plus keep the existing hard-delete option
3. **Streamlined Admin Actions** -- Quick actions directly from the user list (no need to open the detail drawer for common tasks), plus bulk operations

---

## 1. Role Management System

### How It Works
- A new **"Team" tab** in the admin panel (next to Users, Subscriptions, etc.)
- From there, admins can:
  - **Add a new admin or moderator by email** (the user must already have an account)
  - **See all users with elevated roles** in one list
  - **Revoke roles** with one click
- Inside each user's detail drawer, a new **"Role" card** shows their current role and lets you change it

### Role Levels
| Role | What They Can Do |
|------|-----------------|
| **Admin** | Everything: manage users, billing, roles, delete accounts, knowledge base, settings |
| **Moderator** | View users, add notes, send emails, view billing (no refunds, no deletions, no role changes) |
| **User** | Standard app access (no admin panel) |

### Database Change
- Add `'moderator'` to the existing `app_role` enum
- No new tables needed -- uses the existing `user_roles` table

---

## 2. User Archiving

### How It Works
- Add an **"Archive"** button in each user's detail drawer (Actions tab)
- Archived users disappear from the default user list but can be viewed via an **"Archived" filter toggle**
- Archived users retain all their data -- nothing is deleted
- Users can be **unarchived** at any time
- Hard delete remains available for permanent removal

### Database Change
- Add `archived` (boolean, default false) and `archived_at` (timestamp, nullable) columns to `profiles`

### UI Change
- New toggle in the filter bar: "Show Archived" -- off by default
- Archived users show with a muted/dimmed row and an "Archived" badge
- Archive/Unarchive button in the user detail Actions tab

---

## 3. Streamlined Quick Actions

### What Changes
- **Inline quick-action buttons** on each user row in the table: Email, Impersonate, Archive (icon buttons that appear on hover)
- **User count summary cards** at the top of the Users page showing: Total Users, Active Subscribers, Trial Users, Archived
- **Role badge** visible in the user table for admins/moderators so you can spot team members at a glance

---

## Technical Details

### Database Migration
```sql
-- Add moderator to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Add archive columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
```

### Edge Function Updates (`admin-user-management`)
- New actions: `manage_role` (add/remove role for a user), `archive_user`, `unarchive_user`
- `manage_role` validates that only admins (not moderators) can change roles
- `list_users` updated to respect the `archived` filter
- Moderator access check added: moderators can call read-only actions + send_email + add notes, but not billing/delete/role actions

### Frontend Changes

**New file: `src/pages/admin/Team.tsx`**
- Lists all users with admin or moderator roles
- "Add team member" form: enter email, pick role, submit
- Remove role button per row

**Updated: `src/components/AdminTabs.tsx`**
- Add "Team" tab with Shield icon

**Updated: `src/pages/admin/Users.tsx`**
- Add summary stat cards at top (Total, Active, Trial, Archived)
- Add "Show Archived" toggle to filters
- Add role badge column to user table
- Add inline quick-action icons (email, impersonate, archive) on hover
- Add Archive/Unarchive card in user detail Actions tab
- Show role management card in user detail Actions tab

**Updated: `supabase/functions/admin-user-management/index.ts`**
- Add `manage_role`, `archive_user`, `unarchive_user` actions
- Add moderator permission checks to existing actions
- Update `list_users` to filter by `archived` status

### App Routing
- Add `/admin/team` route in `App.tsx`

