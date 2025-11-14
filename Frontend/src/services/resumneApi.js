import { API_BASE_URL } from "../config";

// ----------------------
// Upload Resume
// ----------------------
export async function uploadResume(formData) {
  const res = await fetch(`${API_BASE_URL}/upload/`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

// ----------------------
// Search Resumes
// ----------------------
export async function searchResumes(query, filters = {}) {
  const res = await fetch(`${API_BASE_URL}/search/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, filters }),
  });
  return res.json();
}

// ----------------------
// List all resumes
// ----------------------
export async function listResumes() {
  const res = await fetch(`${API_BASE_URL}/list/`);
  return res.json();
}

// ----------------------
// Fetch PDF securely (proxy)
// ----------------------
export function getPdfProxyUrl(fileUrl) {
  return `${API_BASE_URL}/proxy_resume/?file_url=${encodeURIComponent(fileUrl)}`;
}

// ----------------------
// Validate keyword
// ----------------------
export async function validateWordApi(query) {
  const res = await fetch(`${API_BASE_URL}/validate_word/`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  return res.json();
}
