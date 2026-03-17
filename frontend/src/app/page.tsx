"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("File must be ≤ 50 MB.");
      return;
    }
    setError("");
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      const { job_id } = await res.json();
      router.push(`/job/${job_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🇯🇵 → 🇬🇧 PDF Translator</h1>
        <p style={styles.subtitle}>
          Upload a Japanese PDF (text-based or scanned) and get an English translation.
        </p>

        <div
          style={{ ...styles.dropzone, ...(dragging ? styles.dropzoneDragging : {}) }}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div>
              <div style={styles.fileIcon}>📄</div>
              <div style={styles.fileName}>{file.name}</div>
              <div style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          ) : (
            <div>
              <div style={styles.fileIcon}>📂</div>
              <div>Drag &amp; drop your PDF here, or <strong>click to browse</strong></div>
              <div style={styles.hint}>Supports text-based and scanned (OCR) PDFs • Max 50 MB</div>
            </div>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{ ...styles.button, ...((!file || uploading) ? styles.buttonDisabled : {}) }}
          onClick={onSubmit}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading…" : "Translate PDF"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: "24px" },
  card: { background: "#fff", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,.08)", padding: "40px", maxWidth: "540px", width: "100%", textAlign: "center" },
  title: { fontSize: "28px", fontWeight: "700", marginBottom: "8px" },
  subtitle: { color: "#6c757d", marginBottom: "32px", lineHeight: "1.5" },
  dropzone: { border: "2px dashed #dee2e6", borderRadius: "12px", padding: "48px 24px", cursor: "pointer", transition: "all .2s", marginBottom: "20px", background: "#f8f9fa" },
  dropzoneDragging: { borderColor: "#0070f3", background: "#e8f0fe" },
  fileIcon: { fontSize: "48px", marginBottom: "12px" },
  fileName: { fontWeight: "600", fontSize: "16px", marginBottom: "4px", wordBreak: "break-all" },
  fileSize: { color: "#6c757d", fontSize: "14px" },
  hint: { color: "#adb5bd", fontSize: "13px", marginTop: "8px" },
  error: { background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6cb", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "14px" },
  button: { background: "#0070f3", color: "#fff", border: "none", borderRadius: "8px", padding: "14px 32px", fontSize: "16px", fontWeight: "600", cursor: "pointer", width: "100%", transition: "background .2s" },
  buttonDisabled: { background: "#adb5bd", cursor: "not-allowed" },
};
