CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '', username text NOT NULL DEFAULT '', display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '', photo_url text NOT NULL DEFAULT '', legacy_uid text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (NEW.id, COALESCE(NEW.email,''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.legacy_user_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legacy_uid text NOT NULL UNIQUE, email text NOT NULL,
  username text NOT NULL DEFAULT '', display_name text NOT NULL DEFAULT '', bio text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '', is_admin boolean NOT NULL DEFAULT false,
  claimed_by uuid, claimed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.legacy_user_imports TO service_role;
ALTER TABLE public.legacy_user_imports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chats (
  id text PRIMARY KEY, url_id text NOT NULL, user_id uuid NOT NULL,
  description text NOT NULL DEFAULT '', messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL DEFAULT '', provider text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chats" ON public.chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.projects (
  id text PRIMARY KEY, owner_id uuid NOT NULL, name text NOT NULL DEFAULT 'Untitled',
  sandbox_id text, sandbox_status text NOT NULL DEFAULT 'none', storage_backend text NOT NULL DEFAULT 'database',
  migration_status text NOT NULL DEFAULT 'none', volume_id text, volume_name text NOT NULL DEFAULT '',
  volume_subpath text NOT NULL DEFAULT '', total_bytes bigint NOT NULL DEFAULT 0, total_files integer NOT NULL DEFAULT 0,
  last_active_at timestamptz NOT NULL DEFAULT now(), last_stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.project_files (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL, relative_path text NOT NULL, content text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT 'text/plain', size_bytes bigint NOT NULL DEFAULT 0,
  storage_location text NOT NULL DEFAULT 'database', updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own files" ON public.project_files FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.project_secrets (
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE, name text NOT NULL,
  owner_id uuid NOT NULL, encrypted_value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, name)
);
GRANT ALL ON public.project_secrets TO service_role;
ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_sessions (
  id text PRIMARY KEY, project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL, sandbox_id text, status text NOT NULL DEFAULT 'active',
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_sessions TO authenticated;
GRANT ALL ON public.workspace_sessions TO service_role;
ALTER TABLE public.workspace_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.workspace_sessions FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.cloud_projects (
  project_id text PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE, owner_id uuid NOT NULL,
  api_key text NOT NULL, backend text NOT NULL DEFAULT 'codzer', supabase_url text, supabase_key text,
  supabase_project_ref text, supabase_project_name text, supabase_organization_slug text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cloud_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id text NOT NULL REFERENCES public.cloud_projects(project_id) ON DELETE CASCADE,
  owner_id uuid NOT NULL, name text NOT NULL, columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  read_access text NOT NULL DEFAULT 'public', write_access text NOT NULL DEFAULT 'auth',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE TABLE public.cloud_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id text NOT NULL REFERENCES public.cloud_projects(project_id) ON DELETE CASCADE,
  owner_id uuid NOT NULL, email text NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);
CREATE TABLE public.cloud_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id text NOT NULL, table_name text NOT NULL,
  owner_id uuid NOT NULL, app_user_id uuid REFERENCES public.cloud_users(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, table_name) REFERENCES public.cloud_tables(project_id, name) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE public.cloud_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id text NOT NULL REFERENCES public.cloud_projects(project_id) ON DELETE CASCADE,
  owner_id uuid NOT NULL, app_user_id uuid REFERENCES public.cloud_users(id) ON DELETE SET NULL,
  path text NOT NULL, mime_type text NOT NULL DEFAULT 'application/octet-stream', size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (project_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_projects, public.cloud_tables, public.cloud_rows, public.cloud_files TO authenticated;
GRANT ALL ON public.cloud_projects, public.cloud_tables, public.cloud_rows, public.cloud_files, public.cloud_users TO service_role;
ALTER TABLE public.cloud_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cloud projects" ON public.cloud_projects FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own cloud tables" ON public.cloud_tables FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own cloud rows" ON public.cloud_rows FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own cloud files" ON public.cloud_files FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.supabase_oauth_states (
  state_hash text PRIMARY KEY, user_id uuid NOT NULL,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code_verifier_ciphertext text NOT NULL, redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.supabase_oauth_states TO service_role;
ALTER TABLE public.supabase_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.supabase_oauth_connections (
  user_id uuid PRIMARY KEY, access_token_ciphertext text NOT NULL, refresh_token_ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.supabase_oauth_connections TO service_role;
ALTER TABLE public.supabase_oauth_connections ENABLE ROW LEVEL SECURITY;