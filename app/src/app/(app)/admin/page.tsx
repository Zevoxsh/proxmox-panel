"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function AdminPage() {
  const [vmPlans, setVmPlans] = useState<any[]>([]);
  const [gamePlans, setGamePlans] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [ptero, setPtero] = useState<any>(null);
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const [vmForm, setVmForm] = useState({ name: "", description: "", cpu: 1, ramMb: 1024, diskGb: 20, bandwidthGb: 1000, priceMonthly: 4.99, type: "LXC" });
  const [gameForm, setGameForm] = useState({
    name: "", description: "", game: "minecraft", cpu: 200, ramMb: 2048, diskMb: 20480, databases: 1, backups: 1,
    priceMonthly: 9.99, pteroEggId: 1, pteroAllocationId: 1, pteroDockerImage: "ghcr.io/pterodactyl/yolks:java_17",
    pteroStartup: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar", pteroEnvJson: "{\"EULA\":\"TRUE\"}",
    pteroLimitsJson: "{\"memory\":2048,\"swap\":0,\"disk\":20480,\"io\":500,\"cpu\":200}",
    pteroFeatureLimitsJson: "{\"databases\":1,\"backups\":1,\"allocations\":1}",
  });
  const [nodeForm, setNodeForm] = useState({ name: "", host: "", port: 8006, username: "", password: "", realm: "pam", sslVerify: true });
  const [pteroForm, setPteroForm] = useState({ url: "", apiKey: "" });

  const load = async () => {
    const [v, g, n, p] = await Promise.all([
      fetch(`${getApiBaseUrl()}/admin/vm-plans`, { credentials: "include" }),
      fetch(`${getApiBaseUrl()}/admin/game-plans`, { credentials: "include" }),
      fetch(`${getApiBaseUrl()}/admin/nodes`, { credentials: "include" }),
      fetch(`${getApiBaseUrl()}/admin/ptero`, { credentials: "include" }),
    ]);
    if (v.ok) setVmPlans(await v.json());
    if (g.ok) setGamePlans(await g.json());
    if (n.ok) setNodes(await n.json());
    if (p.ok) setPtero(await p.json());
  };

  useEffect(() => { load(); }, []);

  const createVmPlan = async () => {
    await fetch(`${getApiBaseUrl()}/admin/vm-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(vmForm),
    });
    setVmForm({ ...vmForm, name: "" });
    load();
  };

  const deleteVmPlan = async (id: string) => {
    await fetch(`${getApiBaseUrl()}/admin/vm-plans/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const createGamePlan = async () => {
    await fetch(`${getApiBaseUrl()}/admin/game-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(gameForm),
    });
    setGameForm({ ...gameForm, name: "" });
    load();
  };

  const deleteGamePlan = async (id: string) => {
    await fetch(`${getApiBaseUrl()}/admin/game-plans/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const createNode = async () => {
    await fetch(`${getApiBaseUrl()}/admin/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(nodeForm),
    });
    setNodeForm({ ...nodeForm, name: "", host: "", username: "", password: "" });
    load();
  };

  const deleteNode = async (id: string) => {
    await fetch(`${getApiBaseUrl()}/admin/nodes/${id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const savePtero = async () => {
    await fetch(`${getApiBaseUrl()}/admin/ptero`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(pteroForm),
    });
    load();
  };

  const loadTemplates = async (nodeId: string, storage?: string) => {
    const res = await fetch(`${getApiBaseUrl()}/admin/nodes/${nodeId}/templates${storage ? `?storage=${storage}` : ""}`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setTemplates((prev) => ({ ...prev, [nodeId]: data }));
  };

  const saveNodeDefaults = async (node: any, payload: any) => {
    await fetch(`${getApiBaseUrl()}/admin/nodes/${node.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    load();
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl">Admin</h1>
        <p className="text-sm text-muted">Gestion des plans, nodes et Pterodactyl</p>
      </div>

      <section className="card p-5 space-y-4">
        <div className="font-semibold">Pterodactyl</div>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input" placeholder="URL" value={pteroForm.url} onChange={(e) => setPteroForm({ ...pteroForm, url: e.target.value })} />
          <input className="input" placeholder="API Key" value={pteroForm.apiKey} onChange={(e) => setPteroForm({ ...pteroForm, apiKey: e.target.value })} />
        </div>
        <button className="btn btn-primary" onClick={savePtero}>Enregistrer</button>
        <div className="text-xs text-muted">Actuel: {ptero?.url ?? "non défini"}</div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="font-semibold">Nodes Proxmox</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Nom" value={nodeForm.name} onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })} />
          <input className="input" placeholder="Host" value={nodeForm.host} onChange={(e) => setNodeForm({ ...nodeForm, host: e.target.value })} />
          <input className="input" placeholder="Port" type="number" value={nodeForm.port} onChange={(e) => setNodeForm({ ...nodeForm, port: Number(e.target.value) })} />
          <input className="input" placeholder="Username" value={nodeForm.username} onChange={(e) => setNodeForm({ ...nodeForm, username: e.target.value })} />
          <input className="input" placeholder="Password" type="password" value={nodeForm.password} onChange={(e) => setNodeForm({ ...nodeForm, password: e.target.value })} />
          <input className="input" placeholder="Realm" value={nodeForm.realm} onChange={(e) => setNodeForm({ ...nodeForm, realm: e.target.value })} />
        </div>
        <button className="btn btn-primary" onClick={createNode}>Ajouter</button>

        <div className="mt-4 space-y-3">
          {nodes.map((node) => (
            <div key={node.id} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{node.name}</div>
                  <div className="text-xs text-muted">{node.host}:{node.port} · {node.realm}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-outline" onClick={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}>
                    {expandedNodeId === node.id ? "Fermer" : "Configurer"}
                  </button>
                  <button className="btn btn-outline" onClick={() => deleteNode(node.id)}>Supprimer</button>
                </div>
              </div>

              {expandedNodeId === node.id && (
                <div className="mt-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <input
                      className="input"
                      placeholder="Storage (ex: SAN1)"
                      defaultValue={node.template_storage || ""}
                      onBlur={(e) => saveNodeDefaults(node, { templateStorage: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Template LXC default"
                      defaultValue={node.lxc_template_default || ""}
                      onBlur={(e) => saveNodeDefaults(node, { lxcTemplateDefault: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Template KVM VMID"
                      defaultValue={node.kvm_template_vmid || ""}
                      onBlur={(e) => saveNodeDefaults(node, { kvmTemplateVmid: Number(e.target.value) || null })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-outline" onClick={() => loadTemplates(node.id, node.template_storage || undefined)}>
                      Charger templates
                    </button>
                    <button className="btn btn-outline" onClick={() => saveNodeDefaults(node, { isActive: !node.is_active })}>
                      {node.is_active ? "Désactiver" : "Activer"}
                    </button>
                  </div>

                  {templates[node.id] && (
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="card p-3">
                        <div className="text-sm text-muted">Templates LXC</div>
                        <select
                          className="input mt-2"
                          defaultValue={node.lxc_template_default || ""}
                          onChange={(e) => saveNodeDefaults(node, { lxcTemplateDefault: e.target.value })}
                        >
                          <option value="">--</option>
                          {templates[node.id].lxcTemplates.map((t: any) => (
                            <option key={t.volid} value={t.volid}>{t.volid}</option>
                          ))}
                        </select>
                      </div>
                      <div className="card p-3">
                        <div className="text-sm text-muted">Templates KVM</div>
                        <select
                          className="input mt-2"
                          defaultValue={node.kvm_template_vmid || ""}
                          onChange={(e) => saveNodeDefaults(node, { kvmTemplateVmid: Number(e.target.value) || null })}
                        >
                          <option value="">--</option>
                          {templates[node.id].kvmTemplates.map((t: any) => (
                            <option key={t.vmid} value={t.vmid}>{t.vmid} — {t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="font-semibold">Plans VPS</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Nom" value={vmForm.name} onChange={(e) => setVmForm({ ...vmForm, name: e.target.value })} />
          <input className="input" placeholder="Description" value={vmForm.description} onChange={(e) => setVmForm({ ...vmForm, description: e.target.value })} />
          <select className="input" value={vmForm.type} onChange={(e) => setVmForm({ ...vmForm, type: e.target.value })}>
            <option value="LXC">LXC</option>
            <option value="KVM">KVM</option>
          </select>
          <input className="input" type="number" placeholder="CPU" value={vmForm.cpu} onChange={(e) => setVmForm({ ...vmForm, cpu: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="RAM MB" value={vmForm.ramMb} onChange={(e) => setVmForm({ ...vmForm, ramMb: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Disk GB" value={vmForm.diskGb} onChange={(e) => setVmForm({ ...vmForm, diskGb: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Bandwidth GB" value={vmForm.bandwidthGb} onChange={(e) => setVmForm({ ...vmForm, bandwidthGb: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Prix" value={vmForm.priceMonthly} onChange={(e) => setVmForm({ ...vmForm, priceMonthly: Number(e.target.value) })} />
        </div>
        <button className="btn btn-primary" onClick={createVmPlan}>Créer plan</button>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted">
                <th className="text-left py-2">Nom</th>
                <th className="text-left">Type</th>
                <th className="text-left">CPU</th>
                <th className="text-left">RAM</th>
                <th className="text-left">Disk</th>
                <th className="text-left">Prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vmPlans.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td>{p.type}</td>
                  <td>{p.cpu}</td>
                  <td>{p.ram_mb} MB</td>
                  <td>{p.disk_gb} GB</td>
                  <td>{p.price_monthly} €</td>
                  <td className="text-right"><button className="btn btn-outline" onClick={() => deleteVmPlan(p.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="font-semibold">Plans Gaming</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Nom" value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} />
          <input className="input" placeholder="Jeu" value={gameForm.game} onChange={(e) => setGameForm({ ...gameForm, game: e.target.value })} />
          <input className="input" placeholder="Description" value={gameForm.description} onChange={(e) => setGameForm({ ...gameForm, description: e.target.value })} />
          <input className="input" type="number" placeholder="CPU" value={gameForm.cpu} onChange={(e) => setGameForm({ ...gameForm, cpu: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="RAM MB" value={gameForm.ramMb} onChange={(e) => setGameForm({ ...gameForm, ramMb: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Disk MB" value={gameForm.diskMb} onChange={(e) => setGameForm({ ...gameForm, diskMb: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Prix" value={gameForm.priceMonthly} onChange={(e) => setGameForm({ ...gameForm, priceMonthly: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Egg ID" value={gameForm.pteroEggId} onChange={(e) => setGameForm({ ...gameForm, pteroEggId: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Allocation ID" value={gameForm.pteroAllocationId} onChange={(e) => setGameForm({ ...gameForm, pteroAllocationId: Number(e.target.value) })} />
          <input className="input" placeholder="Docker Image" value={gameForm.pteroDockerImage} onChange={(e) => setGameForm({ ...gameForm, pteroDockerImage: e.target.value })} />
          <input className="input" placeholder="Startup" value={gameForm.pteroStartup} onChange={(e) => setGameForm({ ...gameForm, pteroStartup: e.target.value })} />
          <textarea className="input" placeholder="Env JSON" value={gameForm.pteroEnvJson} onChange={(e) => setGameForm({ ...gameForm, pteroEnvJson: e.target.value })} />
          <textarea className="input" placeholder="Limits JSON" value={gameForm.pteroLimitsJson} onChange={(e) => setGameForm({ ...gameForm, pteroLimitsJson: e.target.value })} />
          <textarea className="input" placeholder="Feature Limits JSON" value={gameForm.pteroFeatureLimitsJson} onChange={(e) => setGameForm({ ...gameForm, pteroFeatureLimitsJson: e.target.value })} />
        </div>
        <button className="btn btn-primary" onClick={createGamePlan}>Créer plan</button>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted">
                <th className="text-left py-2">Nom</th>
                <th className="text-left">Jeu</th>
                <th className="text-left">CPU</th>
                <th className="text-left">RAM</th>
                <th className="text-left">Disk</th>
                <th className="text-left">Prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gamePlans.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-2">{p.name}</td>
                  <td>{p.game}</td>
                  <td>{p.cpu}</td>
                  <td>{p.ram_mb} MB</td>
                  <td>{p.disk_mb} MB</td>
                  <td>{p.price_monthly} €</td>
                  <td className="text-right"><button className="btn btn-outline" onClick={() => deleteGamePlan(p.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
