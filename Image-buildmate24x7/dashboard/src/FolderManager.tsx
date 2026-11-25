import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Folder = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  display_order: number;
  image_count: number;
  children_count: number;
  created_at: string;
  updated_at: string;
};
type FolderResponse = { items: Folder[]; total: number };
type FolderManagerProps = { token: string };
type FolderRow = { folder: Folder; depth: number };

function flattenFolders(folders: Folder[]): FolderRow[] {
  const rows: FolderRow[] = [];
  const visited = new Set<string>();
  function visit(parentId: string | null, depth: number) {
    const siblings = folders
      .filter((folder) => folder.parent_id === parentId)
      .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
    for (const folder of siblings) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      rows.push({ folder, depth });
      visit(folder.id, depth + 1);
    }
  }
  visit(null, 0);
  for (const folder of folders) {
    if (!visited.has(folder.id)) rows.push({ folder, depth: 0 });
  }
  return rows;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
    if (body.detail) return JSON.stringify(body.detail);
  } catch {
    // Use the generic status below for empty or non-JSON responses.
  }
  return `Request failed (${response.status})`;
}

export default function FolderManager({ token }: FolderManagerProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    return fetch(`/api/v1${path}`, { ...init, headers });
  }

  async function refresh() {
    const response = await request("/folders");
    if (!response.ok) throw new Error(await responseMessage(response));
    const data = (await response.json()) as FolderResponse;
    setFolders(data.items);
  }

  useEffect(() => {
    setError("");
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load folders"));
  }, [token]);

  const rows = useMemo(() => flattenFolders(folders), [folders]);
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? rows.filter(({ folder }) => folder.name.toLocaleLowerCase().includes(needle)) : rows;
  }, [query, rows]);
  const selected = folders.find((folder) => folder.id === selectedId) ?? null;

  function startCreate() {
    setError("");
    setNotice("");
    setMode("create");
    setName("");
    setParentId(selected?.id ?? "");
  }

  function selectFolder(folder: Folder) {
    setSelectedId(folder.id);
    setMode("edit");
    setName(folder.name);
    setParentId(folder.parent_id ?? "");
    setError("");
    setNotice("");
  }

  function disabledParents(folderId: string): Set<string> {
    const blocked = new Set([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder.parent_id && blocked.has(folder.parent_id) && !blocked.has(folder.id)) {
          blocked.add(folder.id);
          changed = true;
        }
      }
    }
    return blocked;
  }

  async function saveFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const isCreate = mode === "create";
      const response = await request(isCreate ? "/folders" : `/folders/${selectedId}`, {
        method: isCreate ? "POST" : "PATCH",
        body: JSON.stringify({ name, parent_id: parentId || null }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const saved = (await response.json()) as Folder;
      await refresh();
      setSelectedId(saved.id);
      setMode("edit");
      setName(saved.name);
      setParentId(saved.parent_id ?? "");
      setNotice(isCreate ? "Folder created." : "Folder updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Folder could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!window.confirm(`Delete “${folder.name}”? It must have no images or subfolders.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await request(`/folders/${folder.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSelectedId(null);
      setMode(null);
      await refresh();
      setNotice("Folder deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Folder could not be deleted");
    }
  }

  async function moveOrder(folder: Folder, direction: -1 | 1) {
    const siblings = folders
      .filter((candidate) => candidate.parent_id === folder.parent_id)
      .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
    const index = siblings.findIndex((candidate) => candidate.id === folder.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return;
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
    setError("");
    setNotice("");
    try {
      const response = await request("/folders/reorder", {
        method: "POST",
        body: JSON.stringify({ items: siblings.map((item, order) => ({ id: item.id, display_order: order * 1000 })) }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await refresh();
      setNotice("Folder order saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Folder order could not be saved");
    }
  }

  const blockedParents = mode === "edit" && selected ? disabledParents(selected.id) : new Set<string>();

  return (
    <section className="folder-manager card" aria-labelledby="folders-title">
      <div className="folder-heading">
        <div><div className="eyebrow">LIBRARY ORGANIZATION</div><h2 id="folders-title">Folders</h2></div>
        <button className="button" type="button" onClick={startCreate}>New folder</button>
      </div>
      <p className="folder-intro">Create nested folders, move them between levels, and set their display order.</p>
      <label htmlFor="folder-search">Search folders</label>
      <input id="folder-search" className="folder-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by folder name" />
      <div className="folder-layout">
        <div className="folder-list" role="list" aria-label="Folder hierarchy">
          {visibleRows.length === 0 ? <p className="folder-empty">{folders.length ? "No folders match your search." : "No folders yet. Create one to begin."}</p> : visibleRows.map(({ folder, depth }) => {
            const siblings = folders.filter((candidate) => candidate.parent_id === folder.parent_id);
            const siblingIndex = [...siblings].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id)).findIndex((candidate) => candidate.id === folder.id);
            return (
              <div className={`folder-row${selectedId === folder.id ? " selected" : ""}`} role="listitem" key={folder.id} style={{ "--depth": depth } as CSSProperties}>
                <button className="folder-select" type="button" onClick={() => selectFolder(folder)} aria-pressed={selectedId === folder.id}>
                  <span className="folder-icon" aria-hidden="true">▰</span>
                  <span className="folder-label"><strong>{folder.name}</strong><small>{folder.image_count} images · {folder.children_count} subfolders</small></span>
                </button>
                <div className="folder-order">
                  <button type="button" aria-label={`Move ${folder.name} up`} title="Move up" disabled={siblingIndex <= 0} onClick={() => void moveOrder(folder, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${folder.name} down`} title="Move down" disabled={siblingIndex >= siblings.length - 1} onClick={() => void moveOrder(folder, 1)}>↓</button>
                </div>
              </div>
            );
          })}
        </div>
        {mode && (
          <form className="folder-editor" onSubmit={(event) => void saveFolder(event)}>
            <h3>{mode === "create" ? "Create folder" : "Edit folder"}</h3>
            <label htmlFor="folder-name">Name</label>
            <input id="folder-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} required autoFocus />
            <label htmlFor="folder-parent">Parent folder</label>
            <select id="folder-parent" value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">Root level</option>
              {rows.map(({ folder, depth }) => <option key={folder.id} value={folder.id} disabled={blockedParents.has(folder.id)}>{"　".repeat(depth)}{folder.name}</option>)}
            </select>
            {selected && <p className="folder-meta">{selected.image_count} images · {selected.children_count} subfolders</p>}
            {error && <p className="error" role="alert">{error}</p>}
            {notice && <p className="folder-success" role="status">{notice}</p>}
            <div className="folder-editor-actions">
              <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : mode === "create" ? "Create folder" : "Save changes"}</button>
              {selected && <button className="button danger" type="button" onClick={() => void deleteFolder(selected)}>Delete</button>}
              <button className="button secondary" type="button" onClick={() => setMode(null)}>Close</button>
            </div>
          </form>
        )}
      </div>
      <p className="folder-footnote">Image counts are zero until image assets are added in a later phase.</p>
    </section>
  );
}
