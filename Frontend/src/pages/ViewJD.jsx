import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Loader } from "lucide-react";

const ViewJD = () => {
  const { id } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    let objectUrl = null;

    const fetchPDF = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/jobs/view/${id}/`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Could not load document");

        const blob = await res.blob();
        objectUrl = window.URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchPDF();

    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);   // depend only on id

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
      <iframe
        src={pdfUrl}
        className="w-full h-full border-none"
        title="Job Description Viewer"
      />
    </div>
  );
};

export default ViewJD;
