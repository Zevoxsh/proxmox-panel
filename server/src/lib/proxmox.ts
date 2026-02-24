import https from "https";

type ProxmoxConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  realm: string;
  sslVerify: boolean;
};

type Ticket = { ticket: string; CSRFPreventionToken: string };

export function createProxmoxClient(cfg: ProxmoxConfig) {
  let ticket: Ticket | null = null;
  const agent = new https.Agent({ rejectUnauthorized: cfg.sslVerify });

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `https://${cfg.host}:${cfg.port}/api2/json${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ticket) {
      headers.Cookie = `PVEAuthCookie=${ticket.ticket}`;
      if (init?.method && init.method !== "GET") {
        headers.CSRFPreventionToken = ticket.CSRFPreventionToken;
      }
    }

    const res = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init?.headers || {}) },
      agent,
    } as RequestInit & { agent: https.Agent });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Proxmox API ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { data: T };
    return data.data;
  }

  async function login() {
    if (ticket) return;
    const params = new URLSearchParams({
      username: `${cfg.username}@${cfg.realm}`,
      password: cfg.password,
    });
    const url = `https://${cfg.host}:${cfg.port}/api2/json/access/ticket`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      agent,
    } as RequestInit & { agent: https.Agent });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Proxmox login failed: ${text}`);
    }
    const json = (await res.json()) as { data: Ticket };
    ticket = json.data;
  }

  return {
    async getTemplates(node: string, storage: string) {
      await login();
      return api<Array<{ volid: string }>>(`/nodes/${node}/storage/${storage}/content?content=vztmpl`);
    },
    async getKVMTemplatesByIds(node: string, ids: number[]) {
      await login();
      const list = await api<Array<{ vmid: number; name: string }>>(`/nodes/${node}/qemu`);
      return list.filter((vm) => ids.includes(vm.vmid));
    },
    async getQemuList(node: string) {
      await login();
      return api<Array<{ vmid: number; name: string; template?: number }>>(`/nodes/${node}/qemu`);
    },
    async getClusterVMIDs() {
      await login();
      const list = await api<Array<{ vmid: number }>>(`/cluster/resources?type=vm`);
      return list.map((v) => v.vmid);
    },
    async createLXC(node: string, payload: Record<string, unknown>) {
      await login();
      return api(`/nodes/${node}/lxc`, { method: "POST", body: JSON.stringify(payload) });
    },
    async cloneKVMTemplate(node: string, vmid: number, payload: Record<string, unknown>) {
      await login();
      return api(`/nodes/${node}/qemu/${vmid}/clone`, { method: "POST", body: JSON.stringify(payload) });
    },
    async waitForTask(node: string, upid: string, timeoutMs = 120000) {
      await login();
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const status = await api<{ status: string }>(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
        if (status.status === "stopped") return;
        await new Promise((r) => setTimeout(r, 2000));
      }
      throw new Error("Proxmox task timeout");
    },
    async setKVMConfig(node: string, vmid: number, payload: Record<string, unknown>) {
      await login();
      return api(`/nodes/${node}/qemu/${vmid}/config`, { method: "POST", body: JSON.stringify(payload) });
    },
    async startVM(node: string, vmid: number) {
      await login();
      return api(`/nodes/${node}/qemu/${vmid}/status/start`, { method: "POST" });
    },
    async getVMStatus(node: string, vmid: number, type: "lxc" | "qemu") {
      await login();
      return api(`/nodes/${node}/${type}/${vmid}/status/current`);
    },
  };
}
