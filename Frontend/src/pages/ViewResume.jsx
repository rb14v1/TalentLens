import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

export default function ViewResume() {
  const [pdfUrl, setPdfUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileName = params.get("file_name");

    if (!fileName) {
      console.error("No file_name in URL");
      return;
    }

    // Backend returns JSON { url: presignedUrl }
    fetch(`${API_BASE_URL}/view_resume/?file_name=${fileName}`)
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setPdfUrl(data.url);
        } else {
          console.error("No URL returned", data);
        }
      })
      .catch(err => console.error("Failed to load PDF:", err));
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      {pdfUrl ? (
        <iframe
          src={pdfUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Resume PDF"
        />
      ) : (
        <p className="text-center mt-10 text-gray-600">
          Loading resume...
        </p>
      )}
    </div>
  );
}
