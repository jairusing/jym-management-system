CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable row level security and define policies.
-- Every user can read, create, and update only their own profile row.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert_self ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_delete_none ON profiles FOR DELETE USING (false);