

## Plan: Restrict "Generate Report" to Agency Accounts

### What Changes

One file needs a small update: `src/components/insights/InsightsHome.tsx`.

- Import `useBrand` from `@/contexts/BrandContext`
- Call `const { isAgencyUser } = useBrand()` inside the component
- Add `isAgencyUser` to the existing condition that renders the "Generate Report" button: change `{brandId && campaigns.length > 0 && (` to `{brandId && campaigns.length > 0 && isAgencyUser && (`

This uses the existing `isAgencyUser` flag from the brand context, which is already populated from the `profiles.is_agency_user` database column.

### Files to Modify
- `src/components/insights/InsightsHome.tsx` — add import + gate the button behind `isAgencyUser`

