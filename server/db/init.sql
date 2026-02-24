CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('USER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE vm_type AS ENUM ('LXC', 'KVM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE vm_status AS ENUM ('PENDING', 'RUNNING', 'STOPPED', 'SUSPENDED', 'ERROR', 'DELETING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE game_server_status AS ENUM ('PENDING', 'INSTALLING', 'RUNNING', 'STOPPED', 'SUSPENDED', 'ERROR', 'DELETING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  name text,
  role role NOT NULL DEFAULT 'USER',
  stripe_customer_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 8006,
  username text NOT NULL,
  password text NOT NULL,
  realm text NOT NULL DEFAULT 'pam',
  ssl_verify boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  lxc_template_default text,
  kvm_template_vmid integer,
  template_storage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vm_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cpu integer NOT NULL,
  ram_mb integer NOT NULL,
  disk_gb integer NOT NULL,
  bandwidth_gb integer,
  price_monthly numeric(10,2) NOT NULL,
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  type vm_type NOT NULL DEFAULT 'LXC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vmid integer NOT NULL,
  name text NOT NULL,
  type vm_type NOT NULL,
  status vm_status NOT NULL DEFAULT 'PENDING',
  ip text,
  os text,
  ssh_public_key text,
  notes text,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES nodes(id),
  plan_id uuid NOT NULL REFERENCES vm_plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vmid, node_id)
);

CREATE TABLE IF NOT EXISTS ptero_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  game text NOT NULL,
  cpu integer NOT NULL,
  ram_mb integer NOT NULL,
  disk_mb integer NOT NULL,
  databases integer NOT NULL DEFAULT 1,
  backups integer NOT NULL DEFAULT 2,
  allocations integer NOT NULL DEFAULT 1,
  price_monthly numeric(10,2) NOT NULL,
  stripe_price_id text,
  nest_id integer NOT NULL,
  egg_id integer NOT NULL,
  docker_image text NOT NULL,
  startup text NOT NULL,
  env_vars jsonb,
  is_active boolean NOT NULL DEFAULT true,
  panel_id uuid NOT NULL REFERENCES ptero_panels(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptero_uuid text NOT NULL UNIQUE,
  ptero_id integer NOT NULL UNIQUE,
  identifier text NOT NULL UNIQUE,
  name text NOT NULL,
  status game_server_status NOT NULL DEFAULT 'PENDING',
  ptero_user_id integer NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  panel_id uuid NOT NULL REFERENCES ptero_panels(id),
  plan_id uuid NOT NULL REFERENCES game_plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_sub_id text NOT NULL,
  status subscription_status NOT NULL DEFAULT 'ACTIVE',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES vm_plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_sub_id text NOT NULL,
  status subscription_status NOT NULL DEFAULT 'ACTIVE',
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  pending_plan_id uuid,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES game_plans(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  status invoice_status NOT NULL DEFAULT 'OPEN',
  pdf_url text,
  hosted_url text,
  due_date timestamptz,
  paid_at timestamptz,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER nodes_set_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER vm_plans_set_updated_at BEFORE UPDATE ON vm_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER vms_set_updated_at BEFORE UPDATE ON vms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER ptero_panels_set_updated_at BEFORE UPDATE ON ptero_panels FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER game_plans_set_updated_at BEFORE UPDATE ON game_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER game_servers_set_updated_at BEFORE UPDATE ON game_servers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER game_subscriptions_set_updated_at BEFORE UPDATE ON game_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
