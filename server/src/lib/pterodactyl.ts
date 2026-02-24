import axios, { AxiosInstance } from "axios";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PteroServer {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  status: string | null;
  node: string;
  allocation: { ip: string; port: number };
  limits: { memory: number; disk: number; cpu: number };
  feature_limits: { databases: number; backups: number; allocations: number };
  egg: number;
  nest: number;
  user: number;
}

export interface PteroServerResources {
  current_state: "running" | "offline" | "starting" | "stopping";
  is_suspended: boolean;
  resources: {
    memory_bytes: number;
    cpu_absolute: number;
    disk_bytes: number;
    network_rx_bytes: number;
    network_tx_bytes: number;
    uptime: number;
  };
}

export interface PteroUser {
  id: number;
  uuid: string;
  username: string;
  email: string;
  root_admin: boolean;
}

export interface PteroAllocation {
  id: number;
  ip: string;
  port: number;
  assigned: boolean;
}

export interface PteroEgg {
  id: number;
  uuid: string;
  name: string;
  description: string;
  docker_image: string;
  startup: string;
  variables: Array<{
    name: string;
    env_variable: string;
    default_value: string;
    user_viewable: boolean;
    user_editable: boolean;
    rules: string;
  }>;
}

export interface PteroNest {
  id: number;
  uuid: string;
  name: string;
  description: string;
}

export interface CreateServerOptions {
  name: string;
  user: number;
  egg: number;
  docker_image: string;
  startup: string;
  environment: Record<string, string>;
  limits: { memory: number; disk: number; cpu: number; swap?: number; io?: number };
  feature_limits: { databases: number; backups: number; allocations: number };
  allocation?: { default: number };
  deploy?: { locations: number[]; dedicated_ip: boolean; port_range: string[] };
}

// ─────────────────────────────────────────────
// Application API (admin)
// ─────────────────────────────────────────────

export class PteroAppClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    this.http = axios.create({
      baseURL: `${baseUrl.replace(/\/$/, "")}/api/application`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
  }

  // ── Servers ──

  async listServers(): Promise<PteroServer[]> {
    const res = await this.http.get("/servers?per_page=100");
    return res.data.data.map((s: { attributes: PteroServer }) => s.attributes);
  }

  async getServer(id: number): Promise<PteroServer> {
    const res = await this.http.get(`/servers/${id}`);
    return res.data.attributes;
  }

  async createServer(opts: CreateServerOptions): Promise<PteroServer> {
    const res = await this.http.post("/servers", opts);
    return res.data.attributes;
  }

  async suspendServer(id: number): Promise<void> {
    await this.http.post(`/servers/${id}/suspend`);
  }

  async unsuspendServer(id: number): Promise<void> {
    await this.http.post(`/servers/${id}/unsuspend`);
  }

  async deleteServer(id: number, force = false): Promise<void> {
    await this.http.delete(`/servers/${id}${force ? "/force" : ""}`);
  }

  async reinstallServer(id: number): Promise<void> {
    await this.http.post(`/servers/${id}/reinstall`);
  }

  // ── Users ──

  async findOrCreateUser(email: string, username: string, name: string): Promise<PteroUser> {
    // Try to find by email
    const listRes = await this.http.get(`/users?filter[email]=${encodeURIComponent(email)}`);
    const existing = listRes.data.data as Array<{ attributes: PteroUser }>;
    if (existing.length > 0) return existing[0].attributes;

    // Create user
    const res = await this.http.post("/users", {
      email,
      username: username.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 32),
      first_name: name.split(" ")[0] ?? name,
      last_name: name.split(" ").slice(1).join(" ") || "User",
      password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    });
    return res.data.attributes;
  }

  // ── Nests & Eggs ──

  async listNests(): Promise<PteroNest[]> {
    const res = await this.http.get("/nests?per_page=100");
    return res.data.data.map((n: { attributes: PteroNest }) => n.attributes);
  }

  async listEggs(nestId: number): Promise<PteroEgg[]> {
    const res = await this.http.get(`/nests/${nestId}/eggs?include=variables&per_page=100`);
    return res.data.data.map((e: { attributes: PteroEgg }) => e.attributes);
  }

  async getEgg(nestId: number, eggId: number): Promise<PteroEgg> {
    const res = await this.http.get(`/nests/${nestId}/eggs/${eggId}?include=variables`);
    return res.data.attributes;
  }

  // ── Nodes & Allocations ──

  async listAllocations(nodeId: number): Promise<PteroAllocation[]> {
    const res = await this.http.get(`/nodes/${nodeId}/allocations?per_page=100`);
    return res.data.data.map((a: { attributes: PteroAllocation }) => a.attributes);
  }

  async getFirstFreeAllocation(nodeId: number): Promise<number | null> {
    const allocs = await this.listAllocations(nodeId);
    const free = allocs.find((a) => !a.assigned);
    return free?.id ?? null;
  }

  async listNodes(): Promise<Array<{ id: number; name: string; location_id: number; fqdn: string; memory: number; disk: number }>> {
    const res = await this.http.get("/nodes?per_page=100");
    return res.data.data.map((n: { attributes: unknown }) => n.attributes);
  }

  // ── Test connection ──

  async ping(): Promise<boolean> {
    try {
      await this.http.get("/servers?per_page=1");
      return true;
    } catch {
      return false;
    }
  }
}

// ─────────────────────────────────────────────
// Client API (per-server, uses identifier)
// ─────────────────────────────────────────────

export class PteroClientAPI {
  private http: AxiosInstance;

  constructor(baseUrl: string, clientApiKey: string) {
    this.http = axios.create({
      baseURL: `${baseUrl.replace(/\/$/, "")}/api/client`,
      headers: {
        Authorization: `Bearer ${clientApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
  }

  async getServerResources(identifier: string): Promise<PteroServerResources> {
    const res = await this.http.get(`/servers/${identifier}/resources`);
    return res.data.attributes;
  }

  async sendPowerAction(
    identifier: string,
    action: "start" | "stop" | "restart" | "kill"
  ): Promise<void> {
    await this.http.post(`/servers/${identifier}/power`, { signal: action });
  }

  async getServerDetails(identifier: string): Promise<{
    name: string;
    status: string;
    node: string;
    sftp: { ip: string; port: number };
    limits: { memory: number; disk: number; cpu: number };
  }> {
    const res = await this.http.get(`/servers/${identifier}`);
    const a = res.data.attributes;
    return {
      name: a.name,
      status: a.status ?? "running",
      node: a.node,
      sftp: a.sftp_details,
      limits: a.limits,
    };
  }

  async getConsoleSockets(identifier: string): Promise<{ token: string; socket: string }> {
    const res = await this.http.get(`/servers/${identifier}/websocket`);
    return res.data.data;
  }
}

// ─────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────

export function createPteroAppClient(url: string, apiKey: string): PteroAppClient {
  return new PteroAppClient(url, apiKey);
}

export function createPteroClientAPI(url: string, clientApiKey: string): PteroClientAPI {
  return new PteroClientAPI(url, clientApiKey);
}

// Status mapping Pterodactyl → GameServerStatus
export function mapPteroStatus(
  state: string | null | undefined
): "PENDING" | "INSTALLING" | "RUNNING" | "STOPPED" | "SUSPENDED" | "ERROR" {
  if (!state) return "INSTALLING";
  const s = state.toLowerCase();
  if (s === "running") return "RUNNING";
  if (s === "offline") return "STOPPED";
  if (s === "starting" || s === "stopping") return "RUNNING";
  if (s === "installing") return "INSTALLING";
  if (s === "suspended") return "SUSPENDED";
  return "STOPPED";
}
