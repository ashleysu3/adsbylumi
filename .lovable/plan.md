

## Plan: Reorganize Sidebar Navigation

### Current Structure
- **Main**: Drafts, Creative Studio
- **Tools**: Saved Concepts, Offers, My Brand, Troubleshooting
- **Account**: Settings, Admin

### New Structure
- **Create** (replaces "Main"): Drafts, Creative Studio, Concept Library (moved from Tools, renamed from "Saved Concepts")
- **My Brand** (replaces "Tools"): Brand Details (renamed from "My Brand", moved above Offers), Offers, Meta Connection
- **Account**: Settings, Troubleshooting (moved here from Tools), Admin

### Changes in `src/components/AppSidebar.tsx`
1. Rename `mainNav` → label group "Create", add Concept Library entry
2. Rename `toolsNav` → label group "My Brand", reorder to: Brand Details, Offers (remove Saved Concepts and Troubleshooting from here)
3. Add Troubleshooting below Settings in the Account group
4. Update label strings: "Saved Concepts" → "Concept Library", "My Brand" → "Brand Details"

Single file change, ~15 lines affected.

