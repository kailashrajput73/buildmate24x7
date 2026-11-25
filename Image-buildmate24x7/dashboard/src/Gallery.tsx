import { useEffect, useState } from "react";

type Asset = { id: string; folder_id: string | null; original_filename: string; format: string; width: number; height: number; byte_size: number; product_code: string | null; product_name: string | null; original_url: string; created_at: string };
type Folder = { id: string; name: string };
export default function Gallery({ token }: { token: string }) {
  const [assets, setAssets] = useState<Asset[]>([]); const [folders, setFolders] = useState<Folder[]>([]);
  const [query, setQuery] = useState(""); const [format, setFormat] = useState(""); const [folder, setFolder] = useState("");
  const [sort, setSort] = useState("created_at"); const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Asset | null>(null); const [checked, setChecked] = useState<string[]>([]); const [error, setError] = useState("");
  async function load() {
    const params = new URLSearchParams({ limit: "200", sort, direction: sort === "created_at" ? "desc" : "asc" });
    if (query) params.set("q", query); if (format) params.set("format", format); if (folder) params.set("folder_id", folder);
    const response = await fetch(`/api/v1/assets?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Could not load image gallery");
    setAssets((await response.json()).items as Asset[]);
  }
  useEffect(() => { void fetch("/api/v1/folders", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setFolders(d.items)); }, [token]);
  useEffect(() => { const timer = setTimeout(() => { void load().catch(e => setError(e.message)); }, 200); return () => clearTimeout(timer); }, [token, query, format, folder, sort]);
  async function reorder(direction: -1 | 1) {
    const selectedItems = assets.filter(a => checked.includes(a.id));
    if (selectedItems.length < 2 || new Set(selectedItems.map(a => a.folder_id)).size !== 1) return;
    const all = assets.filter(a => a.folder_id === selectedItems[0].folder_id);
    for (const asset of selectedItems) { const from = all.findIndex(a => a.id === asset.id); const to = Math.max(0, Math.min(all.length - 1, from + direction)); [all[from], all[to]] = [all[to], all[from]]; }
    const response = await fetch("/api/v1/assets/reorder", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ items: all.map((a, i) => ({ id: a.id, display_order: i * 1000 })) }) });
    if (response.ok) await load(); else setError("Manual order could not be saved");
  }
  async function exportFile(format: "csv" | "xlsx", selectedOnly: boolean) {
    const payload: Record<string, unknown> = { format, sort, direction: sort === "created_at" ? "desc" : "asc" };
    if (selectedOnly) payload.asset_ids = checked;
    else if (folder) { payload.folder_id = folder; payload.include_subfolders = true; }
    const response = await fetch("/api/v1/exports", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { setError("Export could not be created"); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `buildmate-images.${format}`; link.click(); URL.revokeObjectURL(url);
  }
  async function copyUrls(selectedOnly: boolean) {
    const payload: Record<string, unknown> = { url_kind: "original", sort, direction: sort === "created_at" ? "desc" : "asc" };
    if (selectedOnly) payload.asset_ids = checked; else if (folder) { payload.folder_id = folder; payload.include_subfolders = true; }
    const response = await fetch("/api/v1/urls/copy-list", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) { const data = await response.json(); await navigator.clipboard.writeText(data.urls); setError(`${data.count} URLs copied`); } else setError("Could not copy URLs");
  }
  return <section className="card gallery"><div className="folder-heading"><div><div className="eyebrow">LIBRARY</div><h2>Image gallery <small>{assets.length}</small></h2></div><div><button className="button secondary" onClick={() => setView("grid")}>Grid</button> <button className="button secondary" onClick={() => setView("list")}>List</button></div></div>
    <div className="gallery-filters"><input aria-label="Search images" placeholder="Search filename or product" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter format" value={format} onChange={e => setFormat(e.target.value)}><option value="">All formats</option>{["jpeg","png","webp","avif"].map(f=><option key={f}>{f}</option>)}</select><select aria-label="Filter folder" value={folder} onChange={e => setFolder(e.target.value)}><option value="">All folders</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select aria-label="Sort images" value={sort} onChange={e => setSort(e.target.value)}>{[["created_at","Newest"],["filename","Filename"],["size","Size"],["width","Width"],["manual","Manual order"]].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></div>
    {error && <p role="alert">{error}</p>}<div className={view === "grid" ? "gallery-grid" : "gallery-list"}>{assets.map(a=><article key={a.id} className={selected?.id===a.id ? "asset-card selected" : "asset-card"}><input type="checkbox" aria-label={`Select ${a.original_filename}`} checked={checked.includes(a.id)} onChange={e=>setChecked(c=>e.target.checked?[...c,a.id]:c.filter(id=>id!==a.id))}/><button className="asset-open" onClick={()=>setSelected(a)}><img src={a.original_url} loading="lazy" alt={a.original_filename}/><strong>{a.original_filename}</strong><small>{a.width}×{a.height} · {a.format.toUpperCase()}</small></button></article>)}</div>
    <div className="gallery-actions"><button className="button secondary" onClick={()=>void copyUrls(checked.length>0)}>Copy {checked.length ? "selected" : folder ? "folder" : "all"} URLs</button><button className="button secondary" onClick={()=>void exportFile("csv",checked.length>0)}>Download CSV</button><button className="button secondary" onClick={()=>void exportFile("xlsx",checked.length>0)}>Download Excel</button></div>
    {assets.length===0 && !error && <p>No images match these filters.</p>}{checked.length>0 && <div className="gallery-actions"><span>{checked.length} selected</span><button className="button secondary" onClick={()=>void reorder(-1)}>Move up</button><button className="button secondary" onClick={()=>void reorder(1)}>Move down</button></div>}
    {selected && <div className="preview-backdrop" onClick={()=>setSelected(null)}><section className="preview-panel" onClick={e=>e.stopPropagation()}><button className="button secondary" onClick={()=>setSelected(null)}>Close</button><img src={selected.original_url} alt={selected.original_filename}/><h3>{selected.original_filename}</h3><p>{selected.width}×{selected.height} · {selected.format.toUpperCase()} · {selected.byte_size} bytes</p><p>ID: {selected.id}</p><p>Product: {selected.product_code || selected.product_name || "—"}</p><a href={selected.original_url} target="_blank" rel="noreferrer">Open original</a></section></div>}
  </section>;
}
