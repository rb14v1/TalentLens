// src/pages/Retrieve.jsx
 
import React, { useState } from "react";
import { User, Search, XCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";
 
function Retrieve() {
  const navigate = useNavigate();
 
  const [collapsed, setCollapsed] = useState(false);
 
  const [department, setDepartment] = useState("");
  const [cpdLevel, setCpdLevel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [matchedKeywords, setMatchedKeywords] = useState([]);
 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 
  const [showHighlights, setShowHighlights] = useState(false);
  const [highlightedText, setHighlightedText] = useState("");
 
  const getPdfProxyUrl = (fileUrl) =>
    `${API_BASE_URL}/proxy_resume/?file_url=${encodeURIComponent(fileUrl)}`;
 
  // ⭐ Fetch matched keywords
  const fetchMatchedKeywords = async (resume) => {
    try {
      const response = await fetch(`${API_BASE_URL}/match_keywords/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_skills: resume.skills || [],
          search_text: searchTerm || "",
        }),
      });
 
      if (!response.ok) throw new Error("Keyword match failed");
 
      const data = await response.json();
      setMatchedKeywords(data.matched_keywords || []);
    } catch (err) {
      console.error("Keyword match error:", err);
      setMatchedKeywords([]);
    }
  };
 
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
        headers: { "Content-Type": "application/json" },
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
            payload.department ||
            payload.dept ||
            (payload.s3_url?.includes("/resumes/") ? "Unknown" : ""),
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
          matched_keywords: [],
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
      resume.s3_url?.split("/").pop() ||
      resume.raw_payload?.file_name ||
      resume.raw_payload?.readable_file_name;
 
    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }
 
    const viewUrl = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(
      fileName
    )}`;
    window.open(viewUrl, "_blank", "noopener,noreferrer");
  };
 
  const openModal = (resume) => {
    setSelectedResume(resume);
    fetchMatchedKeywords(resume);
  };
 
  const closeModal = () => {
    setSelectedResume(null);
    setMatchedKeywords([]);
  };
 
  // ⭐⭐⭐ REAL LOCAL PDF DOWNLOAD ⭐⭐⭐
  const handleDownload = async (resume) => {
    try {
      const url = resume.s3_url || resume.raw_payload?.s3_url;
      if (!url) {
        alert("No resume file URL available.");
        return;
      }
 
      const proxyUrl = getPdfProxyUrl(url);
 
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to download file");
 
      const blob = await response.blob();
 
      const fileName =
        resume.file_name ||
        resume.s3_url?.split("/").pop() ||
        "resume.pdf";
 
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download PDF.");
    }
  };
 
  // ⭐ Highlight logic
  const openHighlights = () => {
    if (!selectedResume) return;
 
    let resumeText =
      selectedResume.raw_payload?.resume_text ||
      selectedResume.raw_payload?.text ||
      "";
 
    resumeText = resumeText.replace(/\n{3,}/g, "\n\n");
    resumeText = resumeText
      .replace(/\n\s*•\s*/g, "\n• ")
      .replace(/•\s*\n/g, "• ");
    resumeText = resumeText.replace(/^\s*[•.]?\s*$/gm, "");
    resumeText = resumeText.replace(/\s*•\s*/g, "• ");
    resumeText = resumeText.trim();
 
    let processed = resumeText;
 
    matchedKeywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      processed = processed.replace(
        regex,
        `<mark style="background: yellow; padding: 2px; border-radius: 3px;">${kw}</mark>`
      );
    });
 
    setHighlightedText(processed);
    setShowHighlights(true);
  };
 
  const closeHighlights = () => setShowHighlights(false);
 
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4]">
 
      <GlobalHeader />
 
      <div className="flex flex-1 pt-[24px]">
        <RecruiterSidebar active="Retrieve" setCollapsed={setCollapsed} />
 
        <main
          className={`flex-1 p-8 relative overflow-y-auto transition-all duration-300 ${
            collapsed ? "ml-20" : "ml-72"
          }`}
        >
          <div className="relative z-10 max-w-6xl mx-auto mt-4">
            <h1 className="text-3xl font-bold text-center text-[#0F394D] mb-6">
              Retrieve Resumes
            </h1>
 
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-gray-700 mb-1 font-medium">Search</label>
                <div className="flex items-center border border-gray-300 rounded-lg p-2 bg-white/70 backdrop-blur">
                  <Search className="text-gray-400 mr-2" size={18} />
                  <input
                    type="text"
                    placeholder="Search Resume..."
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
 
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleSearch}
                className="bg-[#0F394D] text-white px-6 py-2 rounded-lg hover:bg-[#15556b] transition flex items-center gap-2"
              >
                <Search size={16} /> Search
              </button>
 
              <button
                onClick={handleClear}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 flex items-center transition"
              >
                <XCircle className="mr-1" size={18} /> Clear
              </button>
            </div>
 
            {loading ? (
              <p className="text-center text-gray-500">Searching resumes…</p>
            ) : resumes.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="bg-white/80 border shadow-md rounded-2xl p-5 hover:shadow-lg transition"
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
 
                    <button
                      onClick={() => openModal(resume)}
                      className="w-full bg-[#0F394D] text-white py-2 rounded-lg hover:bg-[#15556b] transition"
                    >
                      View Resume
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center mt-10">No resumes to display.</p>
            )}
          </div>
        </main>
      </div>
 
      {selectedResume && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full md:w-[720px] relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-[#0F394D]"
            >
              <X size={22} />
            </button>
 
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
                {selectedResume.matchScore}% match
              </p>
            </div>
 
            <div className="mb-5">
              <p className="font-medium text-gray-700 mb-1">Experience:</p>
              <p className="text-gray-600 text-sm">
                {selectedResume.experience || "—"}
              </p>
            </div>
 
            <div className="mb-5">
              <p className="font-medium text-gray-700 mb-2">Skills:</p>
              <div className="flex flex-wrap gap-2">
                {(selectedResume.skills || []).length > 0 ? (
                  selectedResume.skills.map((skill, i) => (
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
 
            <div className="mb-6">
              <p className="font-medium text-gray-700 mb-2">Matched Keywords:</p>
              <div className="flex flex-wrap gap-2">
                {matchedKeywords.length > 0 ? (
                  matchedKeywords.map((kw, i) => (
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
 
            <div className="flex gap-3">
              <button
                onClick={() => openFullView(selectedResume)}
                className="flex-1 bg-[#21B0BE] text-white py-2 rounded-lg hover:bg-[#16939a] transition"
              >
                Open Full View
              </button>
 
              <button
                onClick={openHighlights}
                className="flex-1 bg-black text-white py-2 rounded-lg font-medium hover:bg-[#1a1a1a] transition"
              >
                Highlights
              </button>
 
              {/* <button
                onClick={() => handleDownload(selectedResume)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-[#053245] hover:shadow transition"
              >
                Download
              </button> */}
            </div>
          </div>
        </div>
      )}
 
      {showHighlights && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[999] p-4">
          <div className="bg-white rounded-2xl p-6 w-full md:w-[720px] shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={closeHighlights}
              className="absolute top-3 right-3 text-gray-700 hover:text-black"
            >
              <X size={22} />
            </button>
 
            <h2 className="text-xl font-semibold mb-4 text-[#0F394D]">
              Resume Highlights
            </h2>
 
            <p className="text-gray-600 mb-4 text-sm">
              Showing highlighted matched skills inside the resume text.
            </p>
 
            <div
              className="prose max-w-none whitespace-pre-wrap leading-relaxed text-sm"
              dangerouslySetInnerHTML={{ __html: highlightedText }}
            />
          </div>
        </div>
      )}
 
    </div>
  );
}
 
export default Retrieve;
 
 