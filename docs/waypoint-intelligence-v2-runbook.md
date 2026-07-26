# Waypoint intelligence v2 rebuild runbook

The rebuild is deliberately split into reversible steps. Do not delete existing
knowledge manually.

1. Run `supabase/migrations/202607260015_waypoint_intelligence_v2.sql` in a new
   Supabase SQL editor query.
2. Restart the development server so the application uses the v2 contracts.
3. Create an immutable archive:

   ```bash
   curl -X POST http://localhost:3000/api/v1/knowledge/rebuild/archive
   ```

   Keep the returned archive ID.
4. Open the existing CV in `/cvs` and run extraction again. V2 stores exact
   source blocks, activates safe claims, and sends questionable claims to
   `/knowledge/exceptions`.
5. Use **Re-parse description** for previously analysed jobs. **Re-score latest
   knowledge** intentionally keeps the stored requirement parse.

The migration and archive are additive. Current knowledge is not removed by the
migration. Derived records should only be retired after the v2 extraction and
regression fixtures have been checked.
