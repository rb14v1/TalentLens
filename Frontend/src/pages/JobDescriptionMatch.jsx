// Frontend/src/pages/JobDescriptionMatch.jsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Search, ArrowLeft, X, Eye, Sparkles, Loader, CheckCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";

const JobDescriptionMatch = () => {
  const [allMatches, setAllMatches] = useState([]); // Stores ALL 100+ resumes
  const [page, setPage] = useState(1);              // Current page number
  const [sortOption, setSortOption] = useState("score_desc"); // Default sort

  const navigate = useNavigate();
  const location = useLocation();
  // MATCHED: collapsed default and setter like Upload.jsx
  const [collapsed, setCollapsed] = useState(true);

  const observer = useRef();

  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdKeywords, setJdKeywords] = useState([]);
  const [matchingResumes, setMatchingResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);
  const [error, setError] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // SUBMISSION FLOW (existing)
  const [submissionMode, setSubmissionMode] = useState(false);
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [confirmPopup, setConfirmPopup] = useState(false);
  

  // JD info for saving
  const [currentJD, setCurrentJD] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // HIGHLIGHT STATE
  const [highlightResume, setHighlightResume] = useState(null);
  const [showHighlights, setShowHighlights] = useState(false);

  // NEW: required experience extracted from backend JD processing
  const [requiredExperience, setRequiredExperience] = useState(null);
  const [requiredExperienceMin, setRequiredExperienceMin] = useState(null);
  const [requiredExperienceMax, setRequiredExperienceMax] = useState(null);

  useEffect(() => {
    if (location.state?.jobId) {
      console.log("Auto-loading Job:", location.state.jobId);
      autoLoadJD(location.state.jobId, location.state.fileName);
    }
  }, [location.state]);

  // ✅ 3. Function to fetch PDF from Backend
  const autoLoadJD = async (id, name) => {
    setLoadingPdf(true);
    try {
        // Fetch the PDF Blob from your download endpoint
        const res = await fetch(`${API_BASE_URL}/jobs/download/${id}/`, { credentials: "include" });
        if(!res.ok) throw new Error("Failed to fetch JD file");
        
        const blob = await res.blob();
        const file = new File([blob], name, { type: "application/pdf" });

        // Set file state so the UI updates
        setJdFile(file);

        // Automatically trigger extraction
        const formData = new FormData();
        formData.append("jd_file", file);

        const extractRes = await fetch(`${API_BASE_URL}/extract_jd/`, {
            method: "POST",
            body: formData,
        });

        if (!extractRes.ok) throw new Error("Extraction failed");
        
        const data = await extractRes.json();
        setJdText(data.jd_text);
        setJdKeywords(data.keywords || []);

    } catch (e) {
        setError("Could not auto-load the Job Description.");
        console.error(e);
    } finally {
        setLoadingPdf(false);
    }
  };

  // ✅ MISSING FUNCTION: Handles sending the PDF to backend for text extraction
  const handleExtractJD = async (file) => {
    const formData = new FormData();
    formData.append("jd_file", file);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/extract_jd/`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setJdText(data.jd_text);
        setJdKeywords(data.keywords);
      } else {
        setError(data.error || "Failed to extract JD.");
      }
    } catch (err) {
      setError("Server error during extraction.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setJdFile(file);
      handleExtractJD(file); // ✅ This line works now
    }
  };

  const handleViewResume = (resume) => {
    const fileName =
      resume.file_name ||
      resume.readable_file_name ||
      (resume.s3_url ? resume.s3_url.split("/").pop() : null);

    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }

    const viewUrl = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(
      fileName
    )}`;
    window.open(viewUrl, "_blank");
  };

  const handleMatchResumes = async () => {
    if (!jdFile) return setError("Please upload a Job Description file.");

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("jd_file", jdFile);

      const matchResponse = await fetch(`${API_BASE_URL}/jd-match/`, {
        method: "POST",
        body: formData,
      });

      if (!matchResponse.ok) {
        const errorText = await matchResponse.text();
        throw new Error(errorText);
      }

      const matchData = await matchResponse.json();

      setJdText(matchData.jd_text || "");
      setJdKeywords(matchData.jd_keywords || []);
      setAllMatches(matchData.matches || []); // Store EVERYTHING here
      setMatchingResumes([]); // Clear visible list temporarily
      setPage(1);
      setMatchCount(matchData.total_matches || 0);

      const minVal =
        matchData.required_experience_min !== undefined
          ? matchData.required_experience_min
          : matchData.required_experience !== undefined
            ? matchData.required_experience
            : null;

      const maxVal =
        matchData.required_experience_max !== undefined
          ? matchData.required_experience_max
          : null;

      setRequiredExperienceMin(minVal !== null ? minVal : null);
      setRequiredExperienceMax(maxVal !== undefined ? maxVal : null);

      setRequiredExperience(
        matchData.required_experience !== undefined
          ? matchData.required_experience
          : minVal !== null
            ? minVal
            : null
      );

      setSubmissionMode(false);
      setSelectedResumes([]);

      setCurrentJD({
        id: matchData.jd_id || `jd_${Date.now()}`,
        title:
          matchData.jd_title ||
          (jdFile ? jdFile.name.replace(".pdf", "") : "Job Description"),
        department: matchData.department || "engineering_it",
      });
    } catch (err) {
      console.error("Match error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  // ✅ NEW: Sorts and Slices the data whenever Page or Sort changes
  useEffect(() => {
    let sorted = [...allMatches];

    // 1. Sort
    if (sortOption === "score_desc") sorted.sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0));
    else if (sortOption === "score_asc") sorted.sort((a, b) => (a.match_percentage || 0) - (b.match_percentage || 0));
    else if (sortOption === "exp_desc") sorted.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
    else if (sortOption === "exp_asc") sorted.sort((a, b) => (a.experience_years || 0) - (b.experience_years || 0));
    else if (sortOption === "name_asc") sorted.sort((a, b) => (a.candidate_name || "").localeCompare(b.candidate_name || ""));

    // 2. Slice (Lazy Load) - Show 10 items per page
    const visibleCount = page * 10;
    setMatchingResumes(sorted.slice(0, visibleCount));
  }, [allMatches, sortOption, page]);

  // ✅ NEW: Reset page when user changes sort order
  useEffect(() => {
    setPage(1);
  }, [sortOption]);

  // ✅ NEW: The Scroll Observer (Detects when you hit bottom)
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && matchingResumes.length < allMatches.length) {
         setPage(prev => prev + 1); // Load next 10
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, matchingResumes.length, allMatches.length]);

  const toggleResumeSelection = (index) => {
    setSelectedResumes((prev) =>
      prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index]
    );
  };

  // Save confirmed selections
  const handleConfirmSelection = async () => {
    if (!currentJD) {
      alert("No job description context found.");
      return;
    }

    if (selectedResumes.length === 0) {
      alert("Please select at least one resume.");
      return;
    }

    setConfirming(true);

    try {
      const userEmail =
        localStorage.getItem("userEmail") ||
        sessionStorage.getItem("userEmail");

      if (!userEmail) {
        alert("User session expired. Please login again.");
        navigate("/login");
        return;
      }

      const selectedData = selectedResumes.map((idx) => {
        const r = matchingResumes[idx];
        return {
          id: r.id || String(idx),
          name: r.candidate_name || r.name || r.email || "Unknown",
          email: r.email || "",
          match_score:
            r.match_score ??
            (r.match_percentage != null
              ? `${Math.round(r.match_percentage)}%`
              : ""),
          matched_skills: r.matched_skills || [],
          experience_years: r.experience_years || 0,
          s3_url: r.s3_url || "",
          file_name: r.file_name || r.readable_file_name || "",
          candidate_type: r.candidate_type || "",
        };
      });

      const payload = {
        jd_id: currentJD.id,
        jd_title: currentJD.title,
        jd_department: currentJD.department,
        confirmed_by_email: userEmail,
        resumes: selectedData,
      };

      const res = await fetch(`${API_BASE_URL}/confirmed-matches/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save confirmed matches");
      }

      const data = await res.json();

      alert(
        `Resumes submitted successfully! Saved ${data.saved} (skipped ${data.skipped}).`
      );

      setConfirmPopup(false);
      setSubmissionMode(false);
      setSelectedResumes([]);
    } catch (err) {
      console.error(err);
      alert("Failed to submit resumes. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  // ========== HIGHLIGHT HELPERS ==========
  const buildHighlightedResume = (resume) => {
    let text =
      resume?.resume_text ||
      resume?.raw_payload?.resume_text ||
      resume?.text ||
      "";

    if (!text || !text.trim()) return "No resume text available.";

    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/\n\s*â€¢\s*/g, "\nâ€¢ ");
    text = text.replace(/â€¢\s*\n/g, "â€¢ ");
    text = text.replace(/^\s*[â€¢\.]\s*$/gm, "");
    text = text.trim();

    const safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const skills = Array.isArray(resume?.matched_skills)
      ? resume.matched_skills
      : [];

    if (skills.length === 0) return safe.replace(/\n/g, "<br/>");

    const sorted = [...skills].sort((a, b) => b.length - a.length);

    const escaped = sorted.map((s) =>
      String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );

    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    const highlighted = safe.replace(regex, (m) => {
      return `<mark style="background: #fff176; padding: 2px 4px; border-radius: 4px; color: inherit;">${m}</mark>`;
    });

    return highlighted.replace(/\n/g, "<br/>");
  };

  const openHighlightModal = (resume) => {
    setHighlightResume(resume);
    setShowHighlights(true);
  };

  const closeHighlightModal = () => {
    setShowHighlights(false);
    setHighlightResume(null);
  };

  // ========= JSX WITH GLOBAL HEADER ==========
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#E9F1F4] to-[#F8FAFC]">
      {/* GLOBAL HEADER */}
      <GlobalHeader />

      {/* LAYOUT BELOW HEADER (matches Upload.jsx structure) */}
      <div className="flex flex-1 pt-[90px]">
        {/* SIDEBAR: pass setCollapsed so this page adapts like Upload.jsx */}
        <RecruiterSidebar active="Job Description Match" setCollapsed={setCollapsed} />

        {/* MAIN CONTENT: dynamic margin to center/shift based on collapsed */}
        <main
          className="
            flex-1
            p-4 md:p-10
            transition-all
            flex flex-col
          "
          style={{ marginLeft: collapsed ? "5rem" : "18rem" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-[#0F394D] mb-2">
                Job Description Match
              </h1>
              <p className="text-gray-600 text-lg">
                Upload a JD document, then click{" "}
                <strong className="text-[#21B0BE]">Match Resumes</strong>.
              </p>
            </div>

            {/* removed back button intentionally (kept original behavior) */}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Success Message */}
          {matchCount !== null && !error && (
            <div className="mb-6 p-4 bg-[#E0F7FA] border-l-4 border-[#00B4C6] text-[#003547] rounded-lg font-semibold">
              ✓ Found {matchCount} matching resumes
            </div>
          )}

          {/* Upload Section */}
          <div className="bg-white rounded-3xl shadow-xl p-6 mb-8 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label
                  htmlFor="jd-upload"
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#21B0BE] to-[#4DD0E1] text-white text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <Upload size={16} />
                  <span className="truncate max-w-[220px]">
                    {jdFile ? jdFile.name : "Upload JD (PDF)"}
                  </span>
                </label>
                <input
                  id="jd-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <button
                onClick={handleMatchResumes}
                disabled={!jdFile || loading}
                className={`flex items-center gap-2 px-4 py-2 font-semibold rounded-md shadow-md text-sm transition-all ${jdFile && !loading
                  ? "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white hover:shadow-lg hover:scale-105"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Matching...</span>
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    <span className="text-sm">Match Resumes</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Job Description Preview */}
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 max-h-[700px] overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                <div className="p-3 bg-gradient-to-br from-[#21B0BE] to-[#4DD0E1] rounded-xl">
                  <Upload className="text-white" size={20} />
                </div>
                <h2 className="text-2xl font-bold text-[#0F394D]">
                  Job Description Preview
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loadingPdf ? (
       <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Loader className="animate-spin text-[#21B0BE] mb-3" size={32} />
          <p className="font-medium animate-pulse">Loading Job Description...</p>
       </div>
              ):  !jdText ? (
                  <p className="text-gray-400 italic text-center mt-20">
                    Job description content here...
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {jdText}
                    </p>

                    {(requiredExperienceMin !== null ||
                      requiredExperience !== null) && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-600">
                            <strong>Required Experience:</strong>{" "}
                            <span className="text-[#053245] font-semibold">
                              {requiredExperienceMin !== null
                                ? requiredExperienceMin +
                                (requiredExperienceMax
                                  ? ` - ${requiredExperienceMax}`
                                  : "+")
                                : requiredExperience !== null
                                  ? `${requiredExperience}+`
                                  : ""}
                              {" years"}
                            </span>
                          </p>
                        </div>
                      )}

                    {jdKeywords.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-bold text-[#0F394D] mb-3">
                          Key Skills & Keywords:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {jdKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-full border border-blue-200"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Matching Resumes */}
            {/* Right: Matching Resumes */}
<div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 max-h-[700px] overflow-hidden flex flex-col">
  
  {/* ✅ HEADER SECTION START */}
  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 flex-wrap gap-3">
    
    {/* LEFT SIDE: Title + Dropdown */}
    <div className="flex items-center gap-4">
      <h2 className="text-2xl font-bold text-[#0F394D]">
        Matching Resumes
      </h2>

      {/* SORT DROPDOWN - Now grouped on the left */}
      {allMatches.length > 0 && (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold">⇅</span>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="pl-7 pr-3 py-1 text-sm border border-gray-300 rounded-lg bg-gray-50 outline-none cursor-pointer hover:border-[#21B0BE] transition-colors"
          >
            <option value="score_desc">Match % (High → Low)</option>
            <option value="score_asc">Match % (Low → High)</option>
            <option value="exp_desc">Experience (High → Low)</option>
            <option value="exp_asc">Experience (Low → High)</option>
            <option value="name_asc">Name (A → Z)</option>
          </select>
        </div>
      )}
    </div>

    {/* RIGHT SIDE: Buttons */}
    <div className="flex gap-2">
      {matchingResumes.length > 0 && !submissionMode && (
        <button
          onClick={() => setSubmissionMode(true)}
          className="px-4 py-2 bg-gradient-to-r from-[#21B0BE] to-[#4DD0E1] text-white font-semibold rounded-full shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm"
        >
          Select
        </button>
      )}

      {submissionMode && (
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmPopup(true)}
            disabled={selectedResumes.length === 0}
            className={`px-4 py-2 font-semibold rounded-full shadow-md transition-all text-sm ${selectedResumes.length > 0
              ? "bg-[#00B4C6] text-white hover:bg-[#009AAD] hover:scale-105"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
          >
            Submit ({selectedResumes.length})
          </button>
          <button
            onClick={() => {
              setSubmissionMode(false);
              setSelectedResumes([]);
            }}
            className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-full hover:bg-gray-600 transition-all text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  </div>
  {/* ✅ HEADER SECTION END */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {matchingResumes.length === 0 ? (
                  <p className="text-gray-400 italic text-center mt-20">
                    No resumes matched yet...
                  </p>
                ) : (
                  matchingResumes.map((resume, index) => (
                    <div
                      key={index}
                      className={`p-5 rounded-2xl border-2 transition-all ${submissionMode && selectedResumes.includes(index)
                        ? "border-[#00B4C6] bg-[#E0F7FA]"   // selected state (teal highlight)
                        : "border-gray-200 bg-gray-50 hover:border-[#21B0BE] hover:bg-blue-50"
                        }`}
                    >

                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {submissionMode && (
                              <input
                                type="checkbox"
                                checked={selectedResumes.includes(index)}
                                onChange={() => toggleResumeSelection(index)}
                                className="w-5 h-5 accent-[#00B4C6] cursor-pointer"

                              />
                            )}
                            <h3 className="text-xl font-bold text-[#0F394D]">
                              {resume.candidate_name ||
                                resume.name ||
                                "Unknown"}
                            </h3>
                            <span
                              className={`ml-auto px-4 py-1 text-sm font-bold rounded-full ${resume.match_percentage >= 70
                                ? "bg-[#E0F7FA] text-[#003547] border border-[#00B4C6]"   // High match
                                : resume.match_percentage >= 50
                                  ? "bg-[#F0FBFD] text-[#007A87] border border-[#9DE8F0]" // Medium match
                                  : "bg-[#FBECEC] text-[#C62828] border border-[#F5A5A5]" // Low match (soft red)
                                }`}
                            >
                              {Math.round(resume.match_percentage || 0)}% Match
                            </span>

                          </div>

                          <p className="text-sm text-gray-600 mb-3">
                            {resume.email || "No email"}
                          </p>

                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Experience:</strong>{" "}
                            {resume.experience_years || 0} years
                          </p>

                          {(requiredExperienceMin !== null ||
                            requiredExperience !== null) && (
                              <p className="text-sm mb-3">
                                <strong>Requirement:</strong>{" "}
                                {requiredExperienceMin !== null
                                  ? requiredExperienceMin +
                                  (requiredExperienceMax
                                    ? ` - ${requiredExperienceMax}`
                                    : "+")
                                  : `${requiredExperience}+`}
                                {" yrs "}
                                {Number(resume.experience_years || 0) >=
                                  Number(
                                    requiredExperienceMin !== null
                                      ? requiredExperienceMin
                                      : requiredExperience || 0
                                  ) ? (
                                  <span className="text-[#003547] font-semibold ml-2">
                                    ✓ Meets
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-semibold ml-2">
                                    ✕ Short by{" "}
                                    {Number(
                                      (requiredExperienceMin !== null
                                        ? requiredExperienceMin
                                        : requiredExperience || 0) -
                                      Number(resume.experience_years || 0)
                                    )}{" "}
                                    yrs
                                  </span>
                                )}
                              </p>
                            )}

                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Candidate type:</strong>{" "}
                            {resume.candidate_type
                              ? resume.candidate_type
                                .toString()
                                .toLowerCase() === "internal"
                                ? "Internal"
                                : "External"
                              : "Not specified"}
                          </p>

                          {resume.salary != null && (
                            <p className="text-sm text-gray-700 mb-2">
                              <strong>Salary:</strong> {resume.salary}{" "}
                              {resume.salary_currency || ""}
                            </p>
                          )}

                          <div className="mb-3">
                            <p className="text-sm font-semibold text-[#0F394D] mb-2">
                              ✓ Matched Skills:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(resume.matched_skills || []).map(
                                (skill, i) => (
                                  <span
                                    key={i}
                                    className="px-3 py-1 text-xs font-medium bg-[#E0F7FA] text-[#003547] rounded-full border border-[#00B4C6]"

                                  >
                                    {skill}
                                  </span>
                                )
                              )}
                              {(!resume.matched_skills ||
                                resume.matched_skills.length === 0) && (
                                  <span className="text-sm text-gray-400 italic">
                                    No matching skills
                                  </span>
                                )}
                            </div>
                          </div>

                          <button
                            onClick={() => openHighlightModal(resume)}
                            className="w-full bg-gradient-to-r from-[#003547] to-[#00B4C6] text-white py-2 rounded-lg font-medium hover:opacity-90 transition mb-2 flex items-center justify-center gap-2"

                          >
                            <Sparkles size={18} /> Highlights
                          </button>

                          <button
                            onClick={() => handleViewResume(resume)}
                            disabled={loadingPdf}
                            className="w-full px-4 py-2 bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                          >
                            <Eye size={18} />
                            {loadingPdf ? "Loading..." : "View Resume"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={lastElementRef} className="h-4 w-full flex justify-center p-2">
       {matchingResumes.length < allMatches.length && (
          <Loader className="animate-spin text-[#21B0BE]" size={20} />
       )}
    </div>
              </div>
            </div>
          </div>

          {/* Highlight Modal */}
          {showHighlights && highlightResume && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
              <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                  onClick={closeHighlightModal}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                >
                  <X size={22} />
                </button>

                <h2 className="text-3xl font-bold text-[#073C4D] mb-4 flex items-center gap-2">
                  <Sparkles size={26} className="text-yellow-500" /> Resume
                  Highlights
                </h2>

                <div className="mb-4">
                  <p className="font-semibold text-gray-800 mb-2">✓ Matched Skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {highlightResume.matched_skills?.length ? (
                      highlightResume.matched_skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gradient-to-r from-[#003547] to-[#00B4C6] text-white rounded-full text-xs font-medium"

                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        No matched skills listed.
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="rounded-xl border p-4 bg-white text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: buildHighlightedResume(highlightResume),
                  }}
                />
              </div>
            </div>
          )}

          {/* Confirmation Popup */}
          {confirmPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-[#0F394D]">
                    Confirm Submission
                  </h3>
                  <button
                    onClick={() => setConfirmPopup(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>

                <p className="text-gray-700 mb-6">
                  You selected{" "}
                  <strong className="text-[#21B0BE]">
                    {selectedResumes.length}
                  </strong>{" "}
                  resume(s). Are you sure you want to submit?
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={handleConfirmSelection}
                    disabled={confirming}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#003547] to-[#00B4C6] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirming ? "Submitting..." : "Yes, Submit"}
                  </button>
                  <button
                    onClick={() => setConfirmPopup(false)}
                    className="flex-1 px-6 py-3 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default JobDescriptionMatch;
