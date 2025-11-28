import React, { useState } from "react";
import {
  User,
  Search,
  XCircle,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
 
function Retrieve() {
  const navigate = useNavigate();
 
  // ⭐ ADDED FOR ADAPTIVE LAYOUT
  const [collapsed, setCollapsed] = useState(false);
 
  const [department, setDepartment] = useState("");
  const [cpdLevel, setCpdLevel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 
  const getPdfProxyUrl = (fileUrl) =>
    `${API_BASE_URL}/proxy_resume/?file_url=${encodeURIComponent(fileUrl)}`;
 
  const handleSearch = async () => {
    setError(null);
    setLoading(true);
    setResumes([]);
 
    try {
      const payload = {
        query: searchTerm || "",
        filters: {
          department: department || "",
          cpd_level: cpdLevel || "",
        },
      };
 
      const res = await fetch(`${API_BASE_URL}/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
 
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Search failed");
      }
 
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
 
      const mapped = results.map((r) => {
        const payload = r.data || {};
        return {
          id: r.id || Math.random().toString(36).slice(2),
          candidate_name: payload.candidate_name || payload.name || "Unknown",
          role: payload.role || payload.designation || "",
          department:
            payload.department || payload.dept || payload.s3_url?.includes("/resumes/")
              ? "Unknown"
              : "",
          cpdLevel: payload.cpd_level
            ? `Level ${payload.cpd_level}`
            : payload.cpdLevel || "Unknown",
          email: payload.email || "",
          phone: payload.phone || payload.contact || "",
          skills: payload.skills || [],
          experience:
            payload.experience_years !== undefined
              ? `${payload.experience_years} years`
              : payload.experience || "",
          matchScore: Number(r.score) || 0,
          matched_keywords: r.matched_keywords || [],
          s3_url: payload.s3_url || "",
          file_name:
            payload.file_name ||
            payload.readable_file_name ||
            payload.s3_url?.split("/").pop(),
          raw_payload: payload,
        };
      });
 
      setResumes(mapped);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };
 
  const handleClear = () => {
    setDepartment("");
    setCpdLevel("");
    setSearchTerm("");
    setResumes([]);
    setError(null);
    setSelectedResume(null);
  };
 
  const openFullView = (resume) => {
    const fileName =
      resume.file_name ||
      resume.readable_file_name ||
      (resume.s3_url ? resume.s3_url.split("/").pop() : null) ||
      resume.raw_payload?.file_name ||
      resume.raw_payload?.readable_file_name;
 
    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }
 
    const viewUrl = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(fileName)}`;
    window.open(viewUrl, "_blank", "noopener,noreferrer");
  };
 
  const openModal = (resume) => setSelectedResume(resume);
  const closeModal = () => setSelectedResume(null);
 
  const handleDownload = (resume) => {
    const url = resume.s3_url || resume.raw_payload?.s3_url;
    if (!url) {
      alert("No resume file URL available.");
      return;
    }
    const proxy = getPdfProxyUrl(url);
    window.open(proxy, "_blank", "noopener,noreferrer");
  };
 
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4] relative">
 
      {/* ⭐ MAKE SIDEBAR ADAPTIVE */}
      <RecruiterSidebar active="Retrieve" setCollapsed={setCollapsed} />
 
      {/* ⭐ MAIN CONTENT — ADAPTIVE MARGIN */}
      <main
        className={`flex-1 p-10 relative overflow-y-auto transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
 
        {/* BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-8 right-8 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white px-6 py-3 rounded-full shadow-md hover:opacity-90 transition-all flex items-center gap-2 z-30"
        >
          Back
        </button>
 
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-10 pointer-events-none"></div>
 
        <div className="relative z-10 max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-center text-[#0F394D] mb-6">Retrieve</h1>
 
          {/* SEARCH FILTERS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-gray-700 mb-1 font-medium">Search</label>
              <div className="flex items-center border border-gray-300 rounded-lg p-2 bg-white/70 backdrop-blur">
                <Search className="text-gray-400 mr-2" size={18} />
                <input
                  type="text"
                  placeholder="Search Resume (skills, name, role...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </div>
            </div>
 
            <div>
              <label className="block text-gray-700 mb-1 font-medium">CPD Level</label>
              <select
                value={cpdLevel}
                onChange={(e) => setCpdLevel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 bg-white/70 outline-none"
              >
                <option value="">Select CPD Level</option>
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
                <option value="4">Level 4</option>
                <option value="5">Level 5</option>
                <option value="6">Level 6</option>
              </select>
            </div>
          </div>
 
          {/* BUTTONS */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={handleSearch}
              className="bg-[#0F394D] text-white px-6 py-2 rounded-lg hover:bg-[#15556b] transition flex items-center gap-2"
              disabled={loading}
            >
              <Search size={16} /> {loading ? "Searching..." : "Search"}
            </button>
            <button
              onClick={handleClear}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 flex items-center transition"
            >
              <XCircle className="mr-1" size={18} /> Clear
            </button>
          </div>
 
          {/* ERROR */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-100 rounded">
              {error}
            </div>
          )}
 
          {/* RESUME CARDS */}
          {loading ? (
            <div className="text-center text-gray-500">Searching resumes…</div>
          ) : resumes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className="bg-white/80 backdrop-blur-md border border-gray-100 shadow-md rounded-2xl p-5 hover:shadow-lg transition"
                >
                  <div className="flex items-center mb-3">
                    <div className="bg-[#21B0BE]/20 p-2 rounded-full mr-3">
                      <User className="text-[#0F394D]" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {resume.candidate_name}
                      </h3>
                      <p className="text-sm text-gray-500">{resume.role}</p>
                    </div>
                  </div>
 
                  <p className="text-sm text-gray-600 mb-4">
                    <span className="font-medium">CPD Level:</span>{" "}
                    {resume.cpdLevel}
                  </p>
 
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => openModal(resume)}
                      className="flex-1 w-full bg-[#0F394D] text-white py-2 rounded-lg hover:bg-[#15556b] transition"
                    >
                      View Resume
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center mt-10">
              No resumes to display. Use filters and click <b>Search</b>.
            </p>
          )}
        </div>
      </main>
 
      {/* MODAL */}
      {selectedResume && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full md:w-[720px] relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-[#0F394D]"
            >
              <X size={22} />
            </button>
 
            {/* HEADER */}
            <div className="flex items-center mb-4">
              <div className="bg-[#21B0BE]/20 p-2 rounded-full mr-3">
                <User className="text-[#0F394D]" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {selectedResume.candidate_name}
                </h2>
                <p className="text-gray-500 text-sm">{selectedResume.role}</p>
              </div>
            </div>
 
            {/* Modal Info */}
            <div className="text-sm text-gray-700 space-y-1 mb-4">
              <p>
                <span className="font-medium">CPD Level:</span>{" "}
                {selectedResume.cpdLevel}
              </p>
              <p>
                <span className="font-medium">Email:</span>{" "}
                {selectedResume.email || "—"}
              </p>
              <p>
                <span className="font-medium">Phone:</span>{" "}
                {selectedResume.phone || "—"}
              </p>
            </div>
 
            {/* MATCH SCORE */}
            <div className="mb-5">
              <p className="font-medium text-gray-700 mb-2">Match Score:</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-[#21B0BE] to-[#0F394D] h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${selectedResume.matchScore}%` }}
                >
                  <span className="text-xs font-semibold text-white">
                    {selectedResume.matchScore.toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedResume.matchScore}% match with job description
              </p>
            </div>
 
            {/* Experience */}
            <div className="mb-5">
              <p className="font-medium text-gray-700 mb-1">Experience:</p>
              <p className="text-gray-600 text-sm">
                {selectedResume.experience || "—"}
              </p>
            </div>
 
            {/* Skills */}
            <div className="mb-5">
              <p className="font-medium text-gray-700 mb-2">Skills:</p>
              <div className="flex flex-wrap gap-2">
                {(selectedResume.skills || []).length > 0 ? (
                  selectedResume.skills.slice(0, 30).map((skill, i) => (
                    <span
                      key={i}
                      className="bg-[#21B0BE]/10 text-[#0F394D] px-3 py-1 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No skills listed</p>
                )}
              </div>
            </div>
 
            {/* Keywords */}
            <div className="mb-6">
              <p className="font-medium text-gray-700 mb-2">Matched Keywords:</p>
              <div className="flex flex-wrap gap-2">
                {(selectedResume.matched_keywords || []).length > 0 ? (
                  selectedResume.matched_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="bg-[#0F394D]/10 text-[#0F394D] px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No matched keywords</p>
                )}
              </div>
            </div>
 
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => openFullView(selectedResume)}
                className="flex-1 w-full bg-[#21B0BE] text-white py-2 rounded-lg hover:bg-[#16939a] transition text-center"
              >
                Open Full View
              </button>
 
              <button
                onClick={() => handleDownload(selectedResume)}
                className="w-1/3 px-4 py-2 bg-white border border-gray-300 rounded-lg text-[#053245] hover:shadow transition"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 
export default Retrieve;
 
 