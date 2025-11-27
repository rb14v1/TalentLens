import React, { useState } from "react";
import { Upload, Search, ArrowLeft, X, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
 
const JobDescriptionMatch = () => {
  const navigate = useNavigate();
 
  const [collapsed, setCollapsed] = useState(false);
 
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdKeywords, setJdKeywords] = useState([]);
  const [matchingResumes, setMatchingResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);
  const [error, setError] = useState(null);
 
  const [loadingPdf, setLoadingPdf] = useState(false);
 
  // NEW STATES FOR SUBMISSION FLOW
  const [submissionMode, setSubmissionMode] = useState(false);
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [confirmPopup, setConfirmPopup] = useState(false);
 
  const handleFileChange = (e) => setJdFile(e.target.files[0]);
 
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
      setMatchingResumes(matchData.matches || []);
      setMatchCount(matchData.total_matches || 0);
      setSubmissionMode(false);
      setSelectedResumes([]);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
 
    setLoading(false);
  };
 
  const toggleResumeSelection = (id) => {
    setSelectedResumes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
 
  return (
    <div className="min-h-screen flex bg-[#E1F0F4]">
      {/* SIDEBAR */}
      <RecruiterSidebar setCollapsed={setCollapsed} />
 
      {/* MAIN */}
      <div
        className={`flex-1 p-12 transition-all duration-300 ${collapsed ? "ml-20" : "ml-72"
          }`}
      >
        {/* BACK */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-8 right-8 flex items-center gap-2 px-6 py-3 rounded-full
          bg-gradient-to-r from-[#073C4D] to-[#18A9B7] text-white font-semibold shadow-lg
          hover:shadow-xl hover:scale-[1.03] transition-all z-10"
        >
          <ArrowLeft size={18} />
          Back
        </button>
 
        {/* HEADER */}
        <div className="text-center mt-10 mb-14">
          <h1 className="text-5xl font-black text-[#053245] tracking-tight mb-4">
            Job Description Match
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Upload a JD document, then click <strong>Match Resumes</strong>.
          </p>
        </div>
 
        {/* UPLOAD */}
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 shadow-xl border">
          <div className="flex flex-col sm:flex-row gap-5 items-center justify-between">
            <label className="cursor-pointer flex items-center gap-3 text-[#073C4D] bg-[#F3FAFC] px-6 py-3 w-full sm:w-auto rounded-xl border hover:bg-[#E9F5F7] transition shadow-sm">
              <Upload size={22} />
              <span className="font-medium">
                {jdFile ? jdFile.name : "Choose Job Description File"}
              </span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
 
            <button
              onClick={handleMatchResumes}
              disabled={loading || !jdFile}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r
                from-[#053245] to-[#12A7B3] text-white font-semibold shadow-md
                hover:shadow-xl hover:scale-[1.03] disabled:opacity-50 transition flex items-center gap-2 justify-center"
            >
              <Search size={20} />
              {loading ? "Matching..." : "Match Resumes"}
            </button>
          </div>
        </div>
 
        {/* STATUS */}
        <div className="text-center mt-6">
          {error && <p className="text-red-600 font-semibold">{error}</p>}
          {matchCount !== null && !error && (
            <p className="text-green-600 font-medium text-lg">
              ✓ Found {matchCount} matching resumes
            </p>
          )}
        </div>
 
        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12 max-w-7xl mx-auto">
          {/* LEFT — JD PREVIEW */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border">
            <h2 className="text-2xl font-bold text-[#053245] mb-5">
              📄 Job Description Preview
            </h2>
 
            {!jdText ? (
              <p className="text-gray-500 italic text-lg mt-6">
                Job description content here...
              </p>
            ) : (
              <div className="space-y-6">
                <div className="max-h-[400px] overflow-y-auto pr-2 text-gray-700 leading-relaxed text-sm">
                  <p className="whitespace-pre-wrap">{jdText}</p>
                </div>
 
                {jdKeywords.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="font-semibold text-lg text-[#053245] mb-3">
                      Key Skills & Keywords:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {jdKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
 
          {/* RIGHT — MATCHING RESUMES */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border">
            {/* TITLE + SELECT BUTTON */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-[#053245]">
                 Matching Resumes
              </h2>
 
              {/* SELECT BUTTON — enables submission mode */}
              {!submissionMode && matchingResumes.length > 0 && (
                <button
                  onClick={() => setSubmissionMode(true)}
                  className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-[#073C4D] to-[#18A9B7] text-white font-semibold shadow hover:opacity-90"
                >
                  Select
                </button>
              )}
            </div>
 
            {!matchingResumes.length ? (
              <p className="text-gray-500 italic text-lg mt-6">
                No resumes matched yet...
              </p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {matchingResumes.map((resume, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 rounded-xl hover:shadow-md transition bg-gradient-to-r from-white to-gray-50"
                  >
                    {/* HEADER */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {/* Checkbox inside card only in selection mode */}
                        {submissionMode && (
                          <input
                            type="checkbox"
                            className="w-5 h-5"
                            checked={selectedResumes.includes(idx)}
                            onChange={() => toggleResumeSelection(idx)}
                          />
                        )}
 
                        <div>
                          <h3 className="font-bold text-lg text-[#073C4D]">
                            {resume.candidate_name || "Unknown"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {resume.email || "No email"}
                          </p>
                        </div>
                      </div>
 
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${resume.match_percentage >= 70
                            ? "bg-green-100 text-green-700"
                            : resume.match_percentage >= 50
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                      >
                        {Math.round(resume.match_percentage)}% Match
                      </span>
                    </div>
 
                    {/* Experience */}
                    <p className="text-sm text-gray-700 mb-3">
                      <strong>Experience:</strong>{" "}
                      {resume.experience_years || 0} years
                    </p>
 
                    {/* Matched Skills */}
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-green-700 mb-1">
                        ✓ Matched Skills:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(resume.matched_skills || [])
                          .slice(0, 5)
                          .map((skill, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                      </div>
                    </div>
 
                    {/* View button */}
                    <button
                      onClick={() => handleViewResume(resume)}
                      disabled={loadingPdf}
                      className="mt-4 w-full px-4 py-2 bg-gradient-to-r from-[#053245] to-[#12A7B3]
                        text-white rounded-lg text-sm font-semibold hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Eye size={18} />
                      {loadingPdf ? "Loading..." : "View Resume"}
                    </button>
                  </div>
                ))}
              </div>
            )}
 
            {/* CONFIRM BUTTON (only when any resume is selected) */}
            {submissionMode && selectedResumes.length > 0 && (
              <button
                onClick={() => setConfirmPopup(true)}
                className="mt-4 w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white font-semibold shadow-md hover:shadow-lg hover:opacity-90 transition"
              >
                Confirm Selected Resumes
              </button>
            )}
          </div>
        </div>
 
        {/* CONFIRM POPUP */}
        {confirmPopup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-[400px]">
              <h2 className="text-xl font-bold text-[#053245] mb-4">
                Confirm Submission
              </h2>
 
              <p className="text-gray-700 mb-6">
                You selected <strong>{selectedResumes.length}</strong> resume(s).<br />
                Are you sure you want to submit?
              </p>
 
              <div className="flex justify-between">
                <button
                  onClick={() => setConfirmPopup(false)}
                  className="px-6 py-2 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400"
                >
                  Cancel
                </button>
 
                <button
                  onClick={() => {
                    setConfirmPopup(false);
                    alert("Resumes submitted successfully!");
                  }}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white font-semibold hover:opacity-90 transition"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
 
export default JobDescriptionMatch;
 
 