# Vendored supabase-js bundle

**Package:** `@supabase/supabase-js`
**Version:** `2.45.4`
**Source:** `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js`
**File:** `supabase.js`
**SHA-256:** `96277ec00e19df476d7396a8a2586b41ed1033dcf680f5aa79b0c556059792b8`

## Why vendored

MV3 service workers can't load ES modules from CDN at runtime, and this
project has no build step. We commit the UMD bundle to serve it from the
extension itself.

## Verifying integrity

From the repo root:

```bash
shasum -a 256 lib/supabase-js/supabase.js
```

The hash must match the SHA-256 above. If it doesn't, the file was modified —
either maliciously or by someone re-downloading without updating this doc.
Do not trust the bundle until the hash matches or the discrepancy is
explained.

## Updating the bundle

1. Download the new version:
   ```bash
   curl -sSL https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<NEW_VERSION>/dist/umd/supabase.min.js \
     -o lib/supabase-js/supabase.js
   ```
2. Recompute the hash:
   ```bash
   shasum -a 256 lib/supabase-js/supabase.js | awk '{print $1}'
   ```
3. Update the **Version** and **SHA-256** fields in this file.
4. Run the test suite to confirm nothing regressed: `npm test`.
5. Commit both the bundle and this file together.
