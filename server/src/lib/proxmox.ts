import axios, { AxiosInstance } from "axios";
import https from "https";

export interface ProxmoxConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  realm?: string;
  sslVerify?: boolean;
}

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: "running" | "stopped" | "suspended";
  type: "lxc" | "qemu";
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  netin?: number;
  netout?: number;
  node: string;
}

export interface ProxmoxNode {
  node: string;
  status: "online" | "offline";
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
}

export interface CreateLXCOptions {
  vmid: number;
  hostname: string;
  ostemplate: string;
  cores: number;
  memory: number;
  rootfs: string;
  net0?: string;
  password?: string;
  ssh_public_keys?: string;
  pool?: string;
  start?: boolean;
}

export interface LXCConfigOptions {
  cores?: number;
  memory?: number;
  net0?: string;
  password?: string;
  "ssh-public-keys"?: string;
}

export interface CreateKVMOptions {
  vmid: number;
  name: string;
  cores: number;
  memory: number;
  scsi0: string;
  cdrom?: string;
  net0?: string;
  boot?: string;
  start?: boolean;
}

export interface CloneKVMOptions {
  newid: number;
  name: string;
  full?: boolean;
  target?: string;
  storage?: string;
  pool?: string;
}

export interface KVMConfigOptions {
  name?: string;
  cores?: number;
  memory?: number;
  net0?: string;
  boot?: string;
  ciuser?: string;
  cipassword?: string;
  sshkeys?: string;
  ipconfig0?: string;
  serial0?: string;
  vga?: string;
}

export class ProxmoxClient {
  private http: AxiosInstance;
  private ticket: string | null = null;
  private csrfToken: string | null = null;
  private config: ProxmoxConfig;

  constructor(config: ProxmoxConfig) {
    this.config = config;
    this.http = axios.create({
      baseURL: `https://${config.host}:${config.port}/api2/json`,
      httpsAgent: new https.Agent({ rejectUnauthorized: config.sslVerify ?? false }),
      timeout: 15000,
    });
  }

  async authenticate(): Promise<void> {
    const realm = this.config.realm ?? "pam";
    const resp = await this.http.post("/access/ticket", {
      username: `${this.config.username}@${realm}`,
      password: this.config.password,
    });
    this.ticket = resp.data.data.ticket;
    this.csrfToken = resp.data.data.CSRFPreventionToken;
    this.http.defaults.headers.common["Cookie"] = `PVEAuthCookie=${this.ticket}`;
    this.http.defaults.headers.common["CSRFPreventionToken"] = this.csrfToken!;
  }

  private async ensureAuth(): Promise<void> {
    if (!this.ticket) await this.authenticate();
  }

  async getNodes(): Promise<ProxmoxNode[]> {
    await this.ensureAuth();
    const resp = await this.http.get("/nodes");
    return resp.data.data;
  }

  async getVMs(node: string): Promise<ProxmoxVM[]> {
    await this.ensureAuth();
    const [lxcResp, qemuResp] = await Promise.all([
      this.http.get(`/nodes/${node}/lxc`).catch(() => ({ data: { data: [] } })),
      this.http.get(`/nodes/${node}/qemu`).catch(() => ({ data: { data: [] } })),
    ]);
    const lxcs = (lxcResp.data.data as ProxmoxVM[]).map((v) => ({ ...v, type: "lxc" as const, node }));
    const qemus = (qemuResp.data.data as ProxmoxVM[]).map((v) => ({ ...v, type: "qemu" as const, node }));
    return [...lxcs, ...qemus];
  }

  async getVMStatus(node: string, vmid: number, type: "lxc" | "qemu"): Promise<ProxmoxVM> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.get(`/nodes/${node}/${path}/${vmid}/status/current`);
    return { ...resp.data.data, vmid, node, type };
  }

  async startVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/status/start`);
    return resp.data.data;
  }

  async stopVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/status/stop`);
    return resp.data.data;
  }

  async rebootVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/status/reboot`);
    return resp.data.data;
  }

  async shutdownVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/status/shutdown`);
    return resp.data.data;
  }

  async resetVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    // reset only supported on qemu; lxc falls back to reboot
    const path = type === "lxc" ? "lxc" : "qemu";
    const action = type === "lxc" ? "reboot" : "reset";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/status/${action}`);
    return resp.data.data;
  }

  async createLXC(node: string, options: CreateLXCOptions): Promise<string> {
    await this.ensureAuth();
    const resp = await this.http.post(`/nodes/${node}/lxc`, options);
    return resp.data.data;
  }

  async setLXCConfig(node: string, vmid: number, options: LXCConfigOptions): Promise<string> {
    await this.ensureAuth();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const resp = await this.http.post(`/nodes/${node}/lxc/${vmid}/config`, params);
    return resp.data.data;
  }

  async setLXCConfigRaw(node: string, vmid: number, body: string): Promise<string> {
    await this.ensureAuth();
    const resp = await this.http.post(`/nodes/${node}/lxc/${vmid}/config`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return resp.data.data;
  }

  async createKVM(node: string, options: CreateKVMOptions): Promise<string> {
    await this.ensureAuth();
    const resp = await this.http.post(`/nodes/${node}/qemu`, options);
    return resp.data.data;
  }

  async cloneKVMTemplate(node: string, templateVmid: number, options: CloneKVMOptions): Promise<string> {
    await this.ensureAuth();
    const payload: Record<string, string | number> = {
      newid: options.newid,
      name: options.name,
    };
    if (options.full !== undefined) payload.full = options.full ? 1 : 0;
    if (options.target) payload.target = options.target;
    if (options.storage) payload.storage = options.storage;
    if (options.pool) payload.pool = options.pool;
    const resp = await this.http.post(`/nodes/${node}/qemu/${templateVmid}/clone`, payload);
    return resp.data.data;
  }

  async getKVMConfig(node: string, vmid: number): Promise<Record<string, string | number | boolean>> {
    await this.ensureAuth();
    const resp = await this.http.get(`/nodes/${node}/qemu/${vmid}/config`);
    return resp.data.data;
  }

  async setKVMConfig(node: string, vmid: number, options: KVMConfigOptions): Promise<string> {
    await this.ensureAuth();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const resp = await this.http.post(`/nodes/${node}/qemu/${vmid}/config`, params);
    return resp.data.data;
  }

  async setKVMConfigRaw(node: string, vmid: number, body: string): Promise<string> {
    await this.ensureAuth();
    const resp = await this.http.post(`/nodes/${node}/qemu/${vmid}/config`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return resp.data.data;
  }

  async deleteVM(node: string, vmid: number, type: "lxc" | "qemu"): Promise<string> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.delete(`/nodes/${node}/${path}/${vmid}`);
    return resp.data.data;
  }

  async getAuthCookie(): Promise<string> {
    await this.ensureAuth();
    return this.ticket!;
  }

  /** Retourne la première IP non-loopback d'un conteneur LXC via /interfaces */
  async getLXCIP(node: string, vmid: number): Promise<string | null> {
    await this.ensureAuth();
    const resp = await this.http.get(`/nodes/${node}/lxc/${vmid}/interfaces`);
    const ifaces = (resp.data.data ?? []) as Array<{ name: string; inet?: string }>;
    for (const iface of ifaces) {
      if (iface.name === "lo" || !iface.inet) continue;
      return iface.inet.split("/")[0];
    }
    return null;
  }

  /** Retourne la première IPv4 non-loopback d'une VM KVM via le guest agent */
  async getKVMAgentIP(node: string, vmid: number): Promise<string | null> {
    await this.ensureAuth();
    const resp = await this.http.get(`/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`);
    const ifaces = (resp.data.data?.result ?? []) as Array<{
      name: string;
      "ip-addresses"?: Array<{ "ip-address": string; "ip-address-type": string }>;
    }>;
    for (const iface of ifaces) {
      if (iface.name === "lo") continue;
      const v4 = iface["ip-addresses"]?.find((a) => a["ip-address-type"] === "ipv4");
      if (v4) return v4["ip-address"];
    }
    return null;
  }

  async createVncProxy(
    node: string,
    vmid: number,
    type: "lxc" | "qemu"
  ): Promise<{ ticket: string; port: number; cert?: string }> {
    await this.ensureAuth();
    const path = type === "lxc" ? "lxc" : "qemu";
    const resp = await this.http.post(`/nodes/${node}/${path}/${vmid}/vncproxy`, {
      websocket: 1,
    });
    return resp.data.data;
  }

  async getClusterVMIDs(): Promise<Set<number>> {
    await this.ensureAuth();
    const resp = await this.http.get("/cluster/resources?type=vm");
    const items = (resp.data.data as Array<{ vmid: number }>) ?? [];
    return new Set(items.map((v) => Number(v.vmid)).filter(Number.isFinite));
  }

  async waitForTask(node: string, upid: string, timeoutMs = 60000, pollMs = 1500): Promise<void> {
    await this.ensureAuth();
    const deadline = Date.now() + timeoutMs;
    const taskPath = `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`;

    while (Date.now() < deadline) {
      const resp = await this.http.get(taskPath);
      const status = resp.data.data?.status;
      if (status === "stopped") {
        const exit = resp.data.data?.exitstatus;
        if (exit && exit !== "OK") {
          throw new Error(`Proxmox task failed: ${exit}`);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error("Proxmox task timeout");
  }

  async getNodeStats(node: string): Promise<{
    cpu: number;
    memory: { used: number; total: number };
    rootfs: { used: number; total: number };
  }> {
    await this.ensureAuth();
    const resp = await this.http.get(`/nodes/${node}/status`);
    const data = resp.data.data;
    return {
      cpu: data.cpu,
      memory: { used: data.memory.used, total: data.memory.total },
      rootfs: { used: data.rootfs.used, total: data.rootfs.total },
    };
  }

  async getTemplates(node: string, storage = "SAN1"): Promise<Array<{ volid: string; name: string }>> {
    await this.ensureAuth();
    const templResp = await this.http.get(
      `/nodes/${node}/storage/${storage}/content?content=vztmpl`
    );
    const items = (templResp.data.data as Array<{ volid: string }>) ?? [];
    return items.map((t) => {
      const filename = t.volid.split("/").pop() ?? t.volid;
      return {
        volid: t.volid,
        name: filename.replace(/\.tar\.(gz|xz|zst)$/i, ""),
      };
    });
  }

  async getKVMTemplatesByIds(node: string, ids: number[]): Promise<Array<{ vmid: number; name: string }>> {
    await this.ensureAuth();
    const resp = await this.http.get(`/nodes/${node}/qemu`);
    const items = resp.data.data as Array<{ vmid: number; name: string }>;
    const idSet = new Set(ids);
    return items
      .filter((i) => idSet.has(Number(i.vmid)))
      .map((i) => ({ vmid: Number(i.vmid), name: i.name }))
      .sort((a, b) => ids.indexOf(a.vmid) - ids.indexOf(b.vmid));
  }
}

export function createProxmoxClient(config: ProxmoxConfig): ProxmoxClient {
  return new ProxmoxClient(config);
}
