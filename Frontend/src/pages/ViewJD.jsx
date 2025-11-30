// Frontend/src/pages/ViewJD.jsx
 
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Loader } from "lucide-react";
 
const ViewJD = () => {
  const { id } = useParams(); // We get the ID from the URL
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
 
  useEffect(() => {
    const fetchPDF = async () => {
      try {
        // Fetch the PDF Blob from your Backend API
        const res = await fetch(`${API_BASE_URL}/jobs/view/${id}/`, {
          credentials: "include",
        });
 
        if (!res.ok) throw new Error("Could not load document");
 
        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        setError(err.message);
      }
    };
 
    if (id) fetchPDF();
 
    // Cleanup memory when closing
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [id]);
 
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-600 font-bold">
        {error}
      </div>
    );
  }
 
  if (!pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center text-[#21B0BE]">
        <Loader className="animate-spin mr-2" /> Loading Document...
      </div>
    );
  }
 
  return (
    <div className="h-screen w-full bg-[#E9F1F4] flex flex-col">
      {/* The PDF Viewer Frame */}
      <iframe
        src={pdfUrl}
        className="w-full h-full border-none"
        title="Job Description Viewer"
      />
    </div>
  );
};
 
export default ViewJD;
 
 