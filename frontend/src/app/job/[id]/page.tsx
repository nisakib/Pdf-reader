"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total_pages: number;
  current_page: number;
  message: string;
  error?: string;
}

interface PageResult {
  page_number: number;
  japanese_text: string;
  english_text: string;
  ocr_used: boolean;
}

export default function JobPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [pages, setPages] = useState<PageResult[] | null>(null);
  const [error, setError] = useState("");
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/job/${jobId}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data: JobStatus = await res.json();
      setStatus(data);
      return data;
    } catch (err) {
      setError("Failed to fetch job status.");
      return null;
    }
  }, [jobId]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/job/${jobId}/result`);
      if (!res.ok) return;
      const data = await res.json();
      setPages(data.pages);
    } catch {}
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    fetchStatus();

    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s && (s.status === "completed" || s.status === "failed")) {
        clearInterval(interval);
        if (s.status === "completed") fetchResults();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, fetchStatus, fetchResults]);

  const statusColor = {
    pending: "#f39c12",
    processing: "#0070f3",
    completed: "#27ae60",
    failed: "#e74c3c",
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <Link href="/" style={styles.back}>← Upload another PDF</Link>

        <h1 style={styles.title}>Translation Job</h1>
        <div style={styles.jobId}>Job ID: {jobId}</div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {status && (
          <div style={styles.statusCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ ...styles.badge, background: statusColor[status.status] || "#6c757d" }}>
                {status.status.toUpperCase()}
              </span>
              <span style={styles.message}>{status.message}</span>
            </div>

            {status.status !== "completed" && status.status !== "failed" && (
              <>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${status.progress}%` }} />
                </div>
                <div style={styles.progressText}>
                  {status.progress}%
                  {status.total_pages > 0 && ` — Page ${status.current_page} of ${status.total_pages}`}
                </div>
              </>
            )}

            {status.status === "failed" && status.error && (
              <div style={styles.errorBox}>{status.error}</div>
            )}

            {status.status === "completed" && (
              <div style={styles.downloads}>
                <a
                  href={`${API_BASE}/api/job/${jobId}/download/docx`}
                  style={styles.downloadBtn}
                  download
                >
                  📄 Download DOCX
                </a>
                <a
                  href={`${API_BASE}/api/job/${jobId}/download/pdf`}
                  style={styles.downloadBtn}
                  download
                >
                  📑 Download PDF
                </a>
              </div>
            )}
          </div>
        )}

        {pages && pages.length > 0 && (
          <div style={styles.results}>
            <h2 style={styles.resultsTitle}>Results ({pages.length} pages)</h2>
            {pages.map((page) => (
              <div key={page.page_number} style={styles.pageCard}>
                <div
                  style={styles.pageHeader}
                  onClick={() => setExpandedPage(expandedPage === page.page_number ? null : page.page_number)}
                >
                  <span style={styles.pageNum}>Page {page.page_number}</span>
                  {page.ocr_used && <span style={styles.ocrBadge}>OCR</span>}
                  <span style={styles.expandIcon}>{expandedPage === page.page_number ? "▲" : "▼"}</span>
                </div>

                {expandedPage === page.page_number && (
                  <div style={styles.pageContent}>
                    <div style={styles.column}>
                      <div style={styles.columnLabel}>🇯🇵 Japanese (Original)</div>
                      <div style={styles.textBox}>{page.japanese_text || "(no text)"}</div>
                    </div>
                    <div style={styles.column}>
                      <div style={styles.columnLabel}>🇬🇧 English (Translated)</div>
                      <div style={styles.textBox}>{page.english_text || "(no translation)"}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(status?.status === "pending" || status?.status === "processing") && (
          <div style={styles.processingNote}>
            <div style={styles.spinner} />
            Processing your PDF… This page auto-refreshes every 2 seconds.
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "#f8f9fa", padding: "24px" },
  inner: { maxWidth: "900px", margin: "0 auto" },
  back: { display: "inline-block", marginBottom: "20px", fontSize: "14px", color: "#6c757d" },
  title: { fontSize: "28px", fontWeight: "700", marginBottom: "4px" },
  jobId: { fontSize: "13px", color: "#adb5bd", marginBottom: "24px", fontFamily: "monospace" },
  statusCard: { background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", marginBottom: "24px" },
  badge: { color: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "12px", fontWeight: "700", letterSpacing: "0.5px" },
  message: { color: "#495057", fontSize: "15px" },
  progressBar: { background: "#e9ecef", borderRadius: "8px", height: "12px", overflow: "hidden", marginBottom: "8px" },
  progressFill: { background: "#0070f3", height: "100%", borderRadius: "8px", transition: "width .4s ease" },
  progressText: { color: "#6c757d", fontSize: "13px" },
  downloads: { display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" },
  downloadBtn: { background: "#27ae60", color: "#fff", borderRadius: "8px", padding: "10px 20px", fontWeight: "600", fontSize: "14px", display: "inline-block" },
  errorBox: { background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6cb", borderRadius: "8px", padding: "12px", marginBottom: "16px", fontSize: "14px" },
  results: { marginTop: "8px" },
  resultsTitle: { fontSize: "20px", fontWeight: "700", marginBottom: "16px" },
  pageCard: { background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,.05)", marginBottom: "12px", overflow: "hidden" },
  pageHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "16px 20px", cursor: "pointer", userSelect: "none" },
  pageNum: { fontWeight: "600", fontSize: "15px" },
  ocrBadge: { background: "#f39c12", color: "#fff", borderRadius: "4px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" },
  expandIcon: { marginLeft: "auto", color: "#adb5bd" },
  pageContent: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderTop: "1px solid #f1f3f5" },
  column: { padding: "16px 20px", borderRight: "1px solid #f1f3f5" },
  columnLabel: { fontWeight: "600", fontSize: "13px", color: "#6c757d", marginBottom: "10px" },
  textBox: { fontSize: "14px", lineHeight: "1.7", whiteSpace: "pre-wrap", color: "#343a40", maxHeight: "300px", overflowY: "auto" },
  processingNote: { display: "flex", alignItems: "center", gap: "12px", color: "#6c757d", fontSize: "14px", marginTop: "16px" },
  spinner: { width: "20px", height: "20px", border: "3px solid #dee2e6", borderTopColor: "#0070f3", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
