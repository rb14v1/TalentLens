import React, { useState, useEffect } from "react";
import { Eye, User, Mail, Award, Calendar, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";

const MatchedResume = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [matchedJobs, setMatchedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state: per-resume chosen total levels and status + dropdown visibility
  const [levelCount, setLevelCount] = useState({}); // { resumeId: number }
  const [resumeStatus, setResumeStatus] = useState({}); // { resumeId: 'pending' | 'accept' | 'hold' | 'reject' }
  const [openLevelDropdown, setOpenLevelDropdown] = useState({}); // { resumeId: boolean }
  const [openStatusDropdown, setOpenStatusDropdown] = useState({}); // { resumeId: boolean }

  useEffect(() => {
    fetchConfirmedMatches();
  }, []);

  const fetchConfirmedMatches = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/confirmed-matches/list/`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch confirmed matches");
      }

      const data = await response.json();
      setMatchedJobs(Array.isArray(data) ? data : []);

      // initialize local UI state for resumes (preserve if already set)
      const initialLevels = {};
      const initialStatus = {};
      (Array.isArray(data) ? data : []).forEach((job) => {
        (job.resumes || []).forEach((r) => {
          const id = r.id ?? r.resume_id ?? `${job.jd_id}_${Math.random()}`;
          initialLevels[id] = levelCount[id] ?? 1; // default to 1 level
          initialStatus[id] = resumeStatus[id] || "pending";
        });
      });
      setLevelCount((prev) => ({ ...initialLevels, ...prev }));
      setResumeStatus((prev) => ({ ...initialStatus, ...prev }));
    } catch (err) {
      setError("Failed to load matched resumes");
    } finally {
      setLoading(false);
    }
  };

  const handleViewResume = (resume) => {
    const fileName = resume.resume_file_name;
    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }
    const viewUrl = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(
      fileName
    )}`;
    window.open(viewUrl, "_blank");
  };

  // Level dropdown handlers
  const toggleLevelDropdown = (resumeId) => {
    setOpenLevelDropdown((prev) => ({ ...prev, [resumeId]: !prev[resumeId] }));
    // Close status dropdown if open
    setOpenStatusDropdown((prev) => ({ ...prev, [resumeId]: false }));
  };

  const handleLevelSelect = (resumeId, levelNum) => {
    setLevelCount((prev) => ({ ...prev, [resumeId]: levelNum }));
    setOpenLevelDropdown((prev) => ({ ...prev, [resumeId]: false }));
  };

  // Status dropdown handlers
  const toggleStatusDropdown = (resumeId) => {
    setOpenStatusDropdown((prev) => ({ ...prev, [resumeId]: !prev[resumeId] }));
    // Close level dropdown if open
    setOpenLevelDropdown((prev) => ({ ...prev, [resumeId]: false }));
  };

  const handleStatusSelect = (resumeId, newStatus) => {
    setResumeStatus((prev) => ({ ...prev, [resumeId]: newStatus }));
    setOpenStatusDropdown((prev) => ({ ...prev, [resumeId]: false }));
  };

  // small helper to get status label + style
  const statusLabel = (s) => {
    if (!s || s === "pending") return { text: "Pending", className: "bg-gray-100 text-gray-800" };
    if (s === "accept") return { text: "Accepted", className: "bg-green-100 text-green-800" };
    if (s === "hold") return { text: "On Hold", className: "bg-yellow-100 text-yellow-800" };
    if (s === "reject") return { text: "Rejected", className: "bg-red-100 text-red-800" };
    return { text: "Pending", className: "bg-gray-100 text-gray-800" };
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#21B0BE] mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Loading matched resumes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50">
      <HiringManagerSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={`flex-1 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-64"
        } p-8 overflow-auto`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-[#21B0BE] hover:text-[#1a8c97] transition font-semibold"
            >
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 className="text-3xl font-bold text-[#0D1F29]">Matched Resumes</h1>
            <div className="w-20" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {matchedJobs.length === 0 && !error && (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <div className="text-gray-400 mb-4">
                <User size={64} className="mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Matched Resumes Yet</h3>
              <p className="text-gray-500">
                Recruiters will assign matched candidates to your job postings here.
              </p>
            </div>
          )}

          {/* Matched Jobs List */}
          {matchedJobs.map((job) => (
            <div key={job.jd_id} className="bg-white rounded-xl shadow-lg p-6 mb-6">
              {/* Job Header */}
              <div className="border-b border-gray-200 pb-4 mb-6">
                <h2 className="text-2xl font-bold text-[#0D1F29] mb-2">{job.jd_title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Award size={16} className="text-[#21B0BE]" />
                    {job.jd_department}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={16} className="text-[#21B0BE]" />
                    {job.resumes ? job.resumes.length : 0} Candidate(s)
                  </span>
                </div>
              </div>

              {/* Matched Resumes */}
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Matched Candidates</h3>

              {job.resumes && job.resumes.length > 0 ? (
                <div className="space-y-4">
                  {job.resumes.map((resume) => {
                    const resumeId = resume.id ?? resume.resume_id ?? String(Math.random());
                    const status = resumeStatus[resumeId] || "pending";
                    const levels = levelCount[resumeId] ?? 1;
                    const statusInfo = statusLabel(status);

                    return (
                      <div
                        key={resumeId}
                        className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-5 border border-teal-200 hover:shadow-md transition relative"
                      >
                        {/* Top-right controls: total levels dropdown + status dropdown */}
                        <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
                          {/* Total Levels dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => toggleLevelDropdown(resumeId)}
                              className="flex items-center gap-2 px-3 py-1 bg-white border rounded-md text-sm shadow-sm hover:shadow-md"
                              aria-haspopup="true"
                              aria-expanded={!!openLevelDropdown[resumeId]}
                            >
                              <span className="font-medium text-gray-700">Levels: {levels}</span>
                              <svg
                                className={`w-3 h-3 transform ${openLevelDropdown[resumeId] ? "rotate-180" : "rotate-0"}`}
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {openLevelDropdown[resumeId] && (
                              <div className="absolute right-0 mt-2 w-40 bg-white border rounded-md shadow-lg p-2">
                                <div className="text-xs font-semibold text-gray-600 mb-2">Select total interview levels</div>
                                <div className="grid grid-cols-3 gap-2">
                                  {[1, 2, 3, 4, 5, 6].map((n) => (
                                    <button
                                      key={n}
                                      onClick={() => handleLevelSelect(resumeId, n)}
                                      className={`px-2 py-1 rounded-md text-sm w-full ${
                                        levels === n ? "bg-[#21B0BE] text-white" : "bg-gray-50 text-gray-700"
                                      }`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <button
                                    onClick={() => setOpenLevelDropdown((prev) => ({ ...prev, [resumeId]: false }))}
                                    className="px-3 py-1 text-sm bg-[#21B0BE] text-white rounded-md hover:opacity-90"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Status dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => toggleStatusDropdown(resumeId)}
                              className={`flex items-center gap-2 px-3 py-1 bg-white border rounded-md text-sm shadow-sm hover:shadow-md ${statusInfo.className}`}
                            >
                              <span className="font-medium">{statusInfo.text}</span>
                              <svg
                                className={`w-3 h-3 transform ${openStatusDropdown[resumeId] ? "rotate-180" : "rotate-0"}`}
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>

                            {openStatusDropdown[resumeId] && (
                              <div className="absolute right-0 mt-2 w-36 bg-white border rounded-md shadow-lg p-2">
                                <div className="text-xs font-semibold text-gray-600 mb-2">Set status</div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleStatusSelect(resumeId, "accept")}
                                    className="text-sm px-2 py-1 rounded-md bg-green-50 text-green-700"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => handleStatusSelect(resumeId, "hold")}
                                    className="text-sm px-2 py-1 rounded-md bg-yellow-50 text-yellow-700"
                                  >
                                    Hold
                                  </button>
                                  <button
                                    onClick={() => handleStatusSelect(resumeId, "reject")}
                                    className="text-sm px-2 py-1 rounded-md bg-red-50 text-red-700"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => handleStatusSelect(resumeId, "pending")}
                                    className="text-sm px-2 py-1 rounded-md bg-gray-50 text-gray-700"
                                  >
                                    Pending
                                  </button>
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <button
                                    onClick={() => setOpenStatusDropdown((prev) => ({ ...prev, [resumeId]: false }))}
                                    className="px-3 py-1 text-sm bg-[#21B0BE] text-white rounded-md hover:opacity-90"
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Candidate Info */}
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-lg font-bold text-[#0D1F29]">{resume.candidate_name}</h4>
                              {resume.match_score && (
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                    parseInt(resume.match_score) > 70
                                      ? "bg-green-100 text-green-700"
                                      : parseInt(resume.match_score) > 50
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {resume.match_score} Match
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                              <div className="flex items-center gap-2 text-gray-700">
                                <Mail size={16} className="text-[#21B0BE]" />
                                <span>{resume.candidate_email || "No email"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-700">
                                <Award size={16} className="text-[#21B0BE]" />
                                <span>Experience: {resume.experience_years} year(s)</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-700">
                                <Calendar size={16} className="text-[#21B0BE]" />
                                <span>Confirmed: {resume.confirmed_at}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-700">
                                <User size={16} className="text-[#21B0BE]" />
                                <span>By: {resume.confirmed_by}</span>
                              </div>
                            </div>

                            {/* Matched Skills */}
                            {Array.isArray(resume.matched_skills) && resume.matched_skills.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-semibold text-gray-700 mb-2">✓ Matched Skills:</p>
                                <div className="flex flex-wrap gap-2">
                                  {resume.matched_skills.map((skill, idx) => (
                                    <span key={idx} className="px-3 py-1 bg-teal-600 text-white text-xs rounded-full font-medium">
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* View Resume Button */}
                            <button
                              onClick={() => handleViewResume(resume)}
                              className="flex items-center gap-2 bg-[#21B0BE] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1a8c97] transition"
                            >
                              <Eye size={18} />
                              View Resume
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No resumes matched for this job.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatchedResume;
