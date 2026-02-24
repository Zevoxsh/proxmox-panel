CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'USER',
  name text,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nodes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  host text NOT NULL,
  port int NOT NULL DEFAULT 8006,
  username text NOT NULL,
  password text NOT NULL,
  realm text NOT NULL DEFAULT 'pam',
  ssl_verify boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  lxc_template_default text,
  kvm_template_vmid int,
  template_storage text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ptero_panels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  url text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vm_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  cpu int NOT NULL,
  ram_mb int NOT NULL,
  disk_gb int NOT NULL,
  bandwidth_gb int,
  price_monthly numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('LXC','KVM')),
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  game text NOT NULL,
  cpu int NOT NULL,
  ram_mb int NOT NULL,
  disk_mb int NOT NULL,
  databases int NOT NULL DEFAULT 0,
  backups int NOT NULL DEFAULT 0,
  price_monthly numeric NOT NULL,
  stripe_price_id text,
  ptero_egg_id int,
  ptero_allocation_id int,
  ptero_docker_image text,
  ptero_startup text,
  ptero_env_json text,
  ptero_limits_json text,
  ptero_feature_limits_json text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vmid int NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  ip text,
  os text,
  ssh_public_key text,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES nodes(id),
  plan_id uuid NOT NULL REFERENCES vm_plans(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_servers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  status text NOT NULL,
  ptero_server_id int,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES game_plans(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_sub_id text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES vm_plans(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_sub_id text NOT NULL,
  status text NOT NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES game_plans(id),
  pending_plan_id uuid REFERENCES game_plans(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_invoice_id text UNIQUE NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  pdf_url text,
  hosted_url text,
  paid_at timestamptz,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
