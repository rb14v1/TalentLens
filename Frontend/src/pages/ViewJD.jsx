import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";

const ViewJD = () => {
  const { id } = useParams();
  const location = useLocation();
  const [jd, setJd] = useState(location.state?.jdData || null);
  const [loading, setLoading] = useState(!location.state?.jdData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (jd) return;
    const fetchJD = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/jobs/list/`);
        if (!res.ok) throw new Error("Failed to fetch jobs");
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : data;
        const found = list.find((job) => job.id === id);
        if (!found) throw new Error("Job not found");
        setJd(found);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchJD();
  }, [id, jd]);

  if (loading) return <div style={{ padding: 32 }}>Loading JD...</div>;
  if (error) return <div style={{ padding: 32, color: "red" }}>{error}</div>;
  if (!jd) return <div style={{ padding: 32 }}>No JD data found.</div>;

  return (
    <div style={{ padding: "32px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>{jd.title || "Job Description"}</h1>
      <p><strong>Department:</strong> {jd.department}</p>
      <p><strong>Location:</strong> {jd.location}</p>
      <p><strong>Type:</strong> {jd.type}</p>
      <p><strong>Experience:</strong> {jd.experience}</p>
      <p><strong>Salary:</strong> {jd.salary}</p>
      {/* Add more fields as needed */}
      <pre style={{ marginTop: 24, whiteSpace: "pre-wrap" }}>{JSON.stringify(jd, null, 2)}</pre>
    </div>
  );
};

export default ViewJD;
