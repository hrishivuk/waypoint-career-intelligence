# Personal Supabase Auth setup

This procedure links one private Supabase Auth account to the existing Waypoint
profile. Do not commit real credentials or identifiers.

## 1. Add the public Auth configuration locally

Copy the existing project URL into `NEXT_PUBLIC_SUPABASE_URL` and copy the
project's publishable key from Supabase **Project Settings → API Keys**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The publishable key is designed for browser/SSR authentication. The service
role key must remain server-only.

## 2. Create the private user

In Supabase, open **Authentication → Users → Add user** and create the personal
email/password account. Do not put that password in this repository or a chat.

## 3. Link the Auth user to the existing profile

Run this once in the Supabase SQL editor after replacing both placeholders:

```sql
update public.prototype_users
set auth_user_id = (
  select id
  from auth.users
  where lower(email) = lower('YOUR_PRIVATE_EMAIL')
)
where id = 'YOUR_PROTOTYPE_USER_ID'
  and auth_user_id is null;
```

Confirm exactly one row was updated:

```sql
select id, display_name, auth_user_id
from public.prototype_users
where id = 'YOUR_PROTOTYPE_USER_ID';
```

## 4. Verify isolation

Restart the development server, choose **Personal workspace**, and sign in.
Verify that:

- the existing Master Profile appears;
- private CVs remain available;
- signing out returns to workspace selection;
- demo mode shows Jordan Lee and never displays private records.

