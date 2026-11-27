import { useEffect, useState, type DragEvent } from "react";

type Folder = { id: string; name: string; parent_id: string | null };
type UploadResult = { filename: string; status: string; duplicate_warning: boolean; error: string | null; asset: { id: string; format: string; width: number; height: number; byte_size: number; original_url: string } | null };
type Batch = { results: UploadResult[]; succeeded: number; failed: number };
type DirectorySelection = { files: File[]; destinationFolderId: string | null };
type DirectoryItem = { id: number; file: File; path: string; status: "queued" | "uploading" | "uploaded" | "failed"; error?: string; duplicate_warning?: boolean };

type Props = { token: string; onUploaded: () => void; initialFolderId?: string; directorySelection?: DirectorySelection | null; onDirectoryConsumed?: () => void };

export default function UploadManager({ token, onUploaded, initialFolderId, directorySelection, onDirectoryConsumed }: Props) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [productCode, setProductCode] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [retryFiles, setRetryFiles] = useState<File[]>([]);
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([]);
  const [directoryProgress, setDirectoryProgress] = useState(0);
  const [directoryBusy, setDirectoryBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/folders", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load folders");
        const data = (await response.json()) as { items: Folder[] };
        setFolders(data.items);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load folders"));
  }, [token]);

  useEffect(() => {
    setFolderId(initialFolderId || "");
  }, [initialFolderId]);

  useEffect(() => {
    if (!directorySelection) return;
    setFolderId(directorySelection.destinationFolderId || "");
    setDirectoryItems(directorySelection.files.map((file, id) => ({
      id, file,
      path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      status: "queued",
    })));
    setDirectoryProgress(0);
    onDirectoryConsumed?.();
  }, [directorySelection, onDirectoryConsumed]);

  function acceptFiles(selected: FileList | File[]) {
    const incoming = Array.from(selected);
    setFiles((current) => [...current, ...incoming].slice(0, 50));
    setError(incoming.length + files.length > 50 ? "A batch can contain at most 50 files." : "");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    acceptFiles(event.dataTransfer.files);
  }

  function send(selected: File[], retry = false) {
    if (!selected.length || busy) return;
    setError("");
    setBusy(true);
    setProgress(0);
    const form = new FormData();
    if (folderId) form.append("folder_id", folderId);
    form.append("metadata", JSON.stringify({ product_code: productCode || null }));
    selected.forEach((file) => form.append("files[]", file));
    const request = new XMLHttpRequest();
    request.open("POST", "/api/v1/uploads");
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => {
      setBusy(false);
      if (request.status < 200 || request.status >= 300) {
        try { setError(JSON.parse(request.responseText).detail ?? "Upload request failed"); }
        catch { setError("Upload request failed"); }
        return;
      }
      const batch = JSON.parse(request.responseText) as Batch;
      setResults((previous) => retry ? [...previous, ...batch.results] : batch.results);
      setRetryFiles(batch.results.flatMap((item, index) => item.status === "uploaded" ? [] : [selected[index]]));
      if (!retry) setFiles([]);
      if (batch.succeeded) onUploaded();
    };
    request.onerror = () => { setBusy(false); setError("Network error during upload. Select the files and retry."); };
    request.send(form);
  }

  function sendDirectory(retryOnly = false) {
    if (directoryBusy) return;
    const queued = directoryItems.filter(item => retryOnly ? item.status === "failed" : item.status === "queued" || item.status === "failed");
    if (!queued.length) return;
    setDirectoryBusy(true);
    const totalBytes = queued.reduce((sum, item) => sum + item.file.size, 0) || 1;
    const batches: DirectoryItem[][] = [];
    let pendingBatch: DirectoryItem[] = [];
    let pendingBytes = 0;
    const batchByteLimit = 40 * 1024 * 1024;
    for (const item of queued) {
      if (pendingBatch.length && (pendingBatch.length >= 50 || pendingBytes + item.file.size > batchByteLimit)) {
        batches.push(pendingBatch);
        pendingBatch = [];
        pendingBytes = 0;
      }
      pendingBatch.push(item);
      pendingBytes += item.file.size;
    }
    if (pendingBatch.length) batches.push(pendingBatch);
    let completedBytes = 0;
    setDirectoryProgress(0);
    void (async () => {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (batchIndex > 0) await new Promise(resolve => window.setTimeout(resolve, 3100));
        const batchItems = batches[batchIndex];
        setDirectoryItems(current => current.map(item => batchItems.some(batchItem => batchItem.id === item.id) ? { ...item, status: "uploading", error: undefined } : item));
        const form = new FormData();
        if (folderId) form.append("destination_folder_id", folderId);
        form.append("relative_paths", JSON.stringify(batchItems.map(item => item.path)));
        form.append("metadata", JSON.stringify({ product_code: productCode || null }));
        batchItems.forEach(item => form.append("files[]", item.file, item.file.name));
        try {
          const batch: Batch = await new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.open("POST", "/api/v1/uploads/directory");
            request.setRequestHeader("Authorization", `Bearer ${token}`);
            request.upload.onprogress = event => {
              if (event.lengthComputable) setDirectoryProgress(Math.min(99, Math.floor((completedBytes + event.loaded) * 100 / totalBytes)));
            };
            request.onload = () => {
              if (request.status < 200 || request.status >= 300) {
                if (request.status === 413) { reject(new Error("This upload batch exceeds the server request limit. Retry after reducing the image size.")); return; }
                try { reject(new Error(JSON.parse(request.responseText).detail || `Directory upload failed (${request.status})`)); }
                catch (reason) { reject(reason instanceof Error ? reason : new Error("Directory upload failed")); }
                return;
              }
              resolve(JSON.parse(request.responseText) as Batch);
            };
            request.onerror = () => reject(new Error("Network error during directory upload"));
            request.send(form);
          });
          setDirectoryItems(current => current.map(item => {
            const index = batchItems.findIndex(entry => entry.id === item.id);
            if (index < 0) return item;
            const result = batch.results[index];
            return result ? { ...item, status: result.status === "uploaded" ? "uploaded" : "failed", error: result.error || undefined, duplicate_warning: result.duplicate_warning }
              : { ...item, status: "failed", error: "Server did not return a result for this file" };
          }));
          completedBytes += batchItems.reduce((sum, item) => sum + item.file.size, 0);
          setDirectoryProgress(Math.min(100, Math.floor(completedBytes * 100 / totalBytes)));
          if (batch.succeeded) onUploaded();
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "Directory batch failed";
          setDirectoryItems(current => current.map(item => batchItems.some(entry => entry.id === item.id) ? { ...item, status: "failed", error: message } : item));
          completedBytes += batchItems.reduce((sum, item) => sum + item.file.size, 0);
          setDirectoryProgress(Math.min(100, Math.floor(completedBytes * 100 / totalBytes)));
        }
      }
      setDirectoryBusy(false);
    })();
  }

  const failedFiles = results.filter((item) => item.status !== "uploaded");
  return (
    <section className="card upload-manager">
      <div className="folder-heading"><div><div className="eyebrow">IMAGE UPLOAD</div><h2>Add original images</h2></div></div>
      <p className="folder-intro">JPEG, PNG, WebP, or AVIF · up to 50 files per batch · originals are stored unchanged.</p>
      <div className="upload-layout">
        <div>
          <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <strong>Drop images here</strong><span>or choose files from your device</span>
            <label className="button secondary upload-choose">Choose files<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { if (event.target.files) acceptFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
          </div>
          {files.length > 0 && <div className="upload-queue"><strong>{files.length} selected</strong>{files.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}
        </div>
        <div className="upload-options">
          <label htmlFor="upload-folder">Destination folder</label>
          <select id="upload-folder" value={folderId} onChange={(event) => setFolderId(event.target.value)}><option value="">Root (no folder)</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
          <label htmlFor="upload-product-code">Product code (optional)</label>
          <input id="upload-product-code" value={productCode} maxLength={160} onChange={(event) => setProductCode(event.target.value)} />
          <button className="button" type="button" disabled={!files.length || busy} onClick={() => send(files)}>{busy ? `Uploading ${progress}%…` : `Upload ${files.length || "images"}`}</button>
          {busy && <progress max={100} value={progress} aria-label="Upload progress" />}
        </div>
      </div>
      {error && <p className="upload-error" role="alert">{error}</p>}
      {results.length > 0 && <div className="upload-results" role="status"><strong>{results.filter((item) => item.status === "uploaded").length} uploaded · {failedFiles.length} failed</strong>{results.map((item, index) => <div key={`${item.filename}-${index}`}><span>{item.filename}{item.asset ? ` · ${item.asset.format.toUpperCase()} · ${item.asset.width}×${item.asset.height}` : ` · ${item.error}`}{item.duplicate_warning ? " · duplicate content warning" : ""}</span>{item.asset && <a href={item.asset.original_url} target="_blank" rel="noreferrer">Original</a>}</div>)}{retryFiles.length > 0 && !busy && <button type="button" className="button secondary retry-button" onClick={() => send(retryFiles, true)}>Retry failed files</button>}</div>}
      {directoryItems.length > 0 && <div className="directory-upload" aria-live="polite"><div className="directory-upload-heading"><div><strong>Directory upload</strong><small>{directoryItems.length} files · {new Set(directoryItems.map(item => item.path.split("/").slice(0, -1).join("/")).filter(Boolean)).size} folders · {directoryItems.filter(item => item.status === "uploaded").length} uploaded · {directoryItems.filter(item => item.status === "failed").length} failed</small></div><div><button type="button" className="button" disabled={directoryBusy || !directoryItems.some(item => item.status === "queued" || item.status === "failed")} onClick={() => sendDirectory(false)}>{directoryBusy ? `Uploading ${directoryProgress}%…` : "Upload directory"}</button>{directoryItems.some(item => item.status === "failed") && <button type="button" className="button secondary" disabled={directoryBusy} onClick={() => sendDirectory(true)}>Retry failed files</button>}</div></div>{directoryBusy && <progress max={100} value={directoryProgress} aria-label="Directory upload progress"/>}<div className="directory-file-list">{directoryItems.map(item => <div className={`directory-file ${item.status}`} key={item.id}><span title={item.path}>{item.path}</span><strong>{item.status === "failed" ? `Failed · ${item.error}` : item.duplicate_warning ? `${item.status} · duplicate content` : item.status}</strong></div>)}</div></div>}
    </section>
  );
}
