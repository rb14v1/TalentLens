// src/pages/MatchedResume.jsx
import React, { useState, useEffect } from "react";
import { Eye, User, Mail, Award, Calendar, ArrowLeft, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";


const MatchedResume = () => {
  const navigate = useNavigate();

  // --- ADAPTIVE SIDEBAR STATE ---
  const [collapsed, setCollapsed] = useState(true);

  const [matchedJobs, setMatchedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ NEW: State to track which jobs are expanded
  const [expandedJobs, setExpandedJobs] = useState({});

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

  // ✅ GLOBAL STAGE UPDATE FUNCTION
  const handleStageChange = async (matchId, newStage) => {
    try {
      setMatchedJobs((prev) =>
        prev.map((job) => ({
          ...job,
          resumes: job.resumes.map((r) =>
            r.id === matchId ? { ...r, hiring_stage: newStage } : r
          ),
        }))
      );

      const res = await fetch(
        `${API_BASE_URL}/confirmed-matches/stage/${matchId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: newStage }),
        }
      );

      if (!res.ok) throw new Error("Failed to save stage");
    } catch (e) {
      console.error(e);
      alert("Could not update stage. Please try again.");
    }
  };

  // ✅ Toggle Function
  const toggleJob = (jobId) => {
    setExpandedJobs((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
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
      {/* GLOBAL HEADER */}
      <GlobalHeader />

      <div className="flex flex-1 pt-[90px]">
        <HiringManagerSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        <main
          className="flex-1 transition-all p-8 overflow-auto"
          style={{ marginLeft: collapsed ? "5rem" : "18rem" }}
        >
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
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
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Matched Resumes Yet
                </h3>
                <p className="text-gray-500">
                  Recruiters will assign matched candidates to your job postings here.
                </p>
              </div>
            )}

            {/* Matched Jobs List */}
            {matchedJobs.map((job) => {
                const isExpanded = !!expandedJobs[job.jd_id];

                return (
                  <div 
                    key={job.jd_id} 
                    // 🟢 CHANGE 1: White background + Teal Outline (#21B0BE) to match the image style
                    className="bg-white rounded-xl shadow-md mb-6 overflow-hidden border border-[#21B0BE]"
                  >
                    
                    {/* ✅ CLICKABLE HEADER FOR EXPANSION */}
                    <div 
                        onClick={() => toggleJob(job.jd_id)}
                        // 🟢 CHANGE 2: Subtle gray hover effect to keep it clean
                        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div>
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

                      {/* Expand Icon */}
                      <div className="p-2 bg-[#E0F7FA] rounded-full text-[#00838F]">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {/* ✅ CONDITIONAL RENDERING FOR CONTENT */}
                    {isExpanded && (
                        // 🟢 CHANGE 3: Border top matches the outer outline color
                        <div className="px-6 pb-6 pt-2 border-t border-[#21B0BE] bg-gray-50/30">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Matched Candidates</h3>

                            {job.resumes && job.resumes.length > 0 ? (
                            <div className="space-y-4">
                                {job.resumes.map((resume) => {
                                const resumeId = resume.id ?? resume.resume_id ?? String(Math.random());

                                return (
                                    <div
                                    key={resumeId}
                                    className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm hover:shadow-md transition relative"
                                    >
                                    {/* GLOBAL HIRING STAGE DROPDOWN */}
                                    <div className="absolute top-4 right-4 z-20">
                                        <div className="relative">
                                        <select
                                            value={resume.hiring_stage || "Applied"}
                                            onChange={(e) => handleStageChange(resume.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()} 
                                            className={`
                                            appearance-none cursor-pointer text-sm font-medium pl-4 pr-10 py-2 rounded-lg border transition-all duration-200 ease-in-out shadow-sm
                                            focus:outline-none focus:ring-2 focus:ring-offset-1
                                            ${
                                                ["Accepted", "Offer"].includes(resume.hiring_stage)
                                                ? "bg-white text-green-700 border-green-300 focus:ring-green-100 hover:border-green-400"
                                                : ["Rejected"].includes(resume.hiring_stage)
                                                ? "bg-white text-red-600 border-red-200 focus:ring-red-100 hover:border-red-300"
                                                : ["On Hold"].includes(resume.hiring_stage)
                                                ? "bg-white text-amber-600 border-amber-200 focus:ring-amber-100 hover:border-amber-300"
                                                : "bg-white text-gray-600 border-gray-200 hover:border-[#21B0BE] focus:ring-gray-100"
                                            }
                                            `}
                                        >
                                            <optgroup label="Initial Stage">
                                            <option value="Applied">Applied</option>
                                            <option value="Screening">Screening</option>
                                            </optgroup>
                                            <optgroup label="Interview Process">
                                            <option value="Interview L1">Interview L1</option>
                                            <option value="Interview L2">Interview L2</option>
                                            <option value="Interview L3">Interview L3</option>
                                            <option value="Interview L4">Interview L4</option>
                                            <option value="Interview L5">Interview L5</option>
                                            </optgroup>
                                            <optgroup label="Decision">
                                            <option value="Offer">Offer</option>
                                            <option value="Accepted">Accepted</option>
                                            <option value="On Hold">On Hold</option>
                                            <option value="Rejected">Rejected</option>
                                            </optgroup>
                                        </select>

                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
                                            <svg className={`h-4 w-4 text-gray-400`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                                            </svg>
                                        </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-lg font-bold text-[#0D1F29]">
                                            {resume.candidate_name}
                                            </h4>
                                            {resume.match_score && (
                                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${parseInt(resume.match_score) > 70 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
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
                                            <Briefcase size={16} className="text-[#21B0BE]" />
                                            <span>{resume.candidate_type || "External"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-700">
                                            <User size={16} className="text-[#21B0BE]" />
                                            <span>By: {resume.confirmed_by}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-700">
                                              <Calendar size={16} className="text-[#21B0BE]" />
                                              {/* 🟢 CHANGE: Split the string by space and take the first part (the date) */}
                                              <span>Confirmed: {resume.confirmed_at ? resume.confirmed_at.split(" ")[0] : "N/A"}</span>
                                            </div>
                                        </div>

                                        {Array.isArray(resume.matched_skills) && resume.matched_skills.length > 0 && (
                                            <div className="mb-4">
                                            <div className="flex flex-wrap gap-2">
                                                {resume.matched_skills.map((skill, idx) => (
                                                <span key={idx} className="px-3 py-1 bg-teal-600 text-white text-xs rounded-full font-medium">
                                                    {skill}
                                                </span>
                                                ))}
                                            </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleViewResume(resume); }}
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
                    )}
                  </div>
                );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MatchedResume;