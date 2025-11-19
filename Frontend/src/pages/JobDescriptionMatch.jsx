import React, { useState } from "react";
import { Upload, Search, ArrowLeft, X, Eye, Loader } from "lucide-react"; // Ensure icons are imported
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

const JobDescriptionMatch = () => {
  const navigate = useNavigate();

  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdKeywords, setJdKeywords] = useState([]);
  const [matchingResumes, setMatchingResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedResumeUrl, setSelectedResumeUrl] = useState("");
  const [selectedResumeName, setSelectedResumeName] = useState("");
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleFileChange = (e) => setJdFile(e.target.files[0]);

  // =====================================================
  // ✅ FIXED: View Resume (Same logic as Retrieve.jsx)
  // =====================================================
  const handleViewResume = (resume) => {
    // 1. Get the filename
    const fileName =
      resume.file_name ||
      resume.readable_file_name ||
      (resume.s3_url ? resume.s3_url.split("/").pop() : null);

    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }

    // 2. Open the backend URL directly
    // Since the backend now returns HTML, this will open the PDF viewer
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

      console.log("📤 Uploading JD file:", jdFile.name);

      // Call backend
      const matchResponse = await fetch(`${API_BASE_URL}/jd-match/`, {
        method: "POST",
        body: formData,
      });

      if (!matchResponse.ok) {
        const errorText = await matchResponse.text();
        console.error("❌ Backend error:", errorText);
        throw new Error(`Failed to match resumes: ${matchResponse.statusText}`);
      }

      const matchData = await matchResponse.json();

      console.log("🔍 Backend Response:", matchData);

      // Extract data from response
      setJdText(matchData.jd_text || "");
      setJdKeywords(matchData.jd_keywords || []);
      setMatchingResumes(matchData.matches || []);
      setMatchCount(matchData.total_matches || 0);

      if (!matchData.jd_text) {
        console.warn("⚠️ No jd_text in response");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E1F0F4] to-[#F7FBFC] p-12 relative">
      {/* BACK BUTTON */}
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

      {/* UPLOAD BOX */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-5 items-center justify-between">
          {/* Upload Button */}
          <label className="cursor-pointer flex items-center gap-3 text-[#073C4D] bg-[#F3FAFC] px-6 py-3 w-full sm:w-auto rounded-xl border border-gray-300 hover:bg-[#E9F5F7] transition shadow-sm">
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

          {/* Match Button */}
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

      {/* STATUS MESSAGE */}
      <div className="text-center mt-6">
        {error && <p className="text-red-600 font-semibold">{error}</p>}
        {matchCount !== null && !error && (
          <p className="text-green-600 font-medium text-lg">
            ✓ Found {matchCount} matching resumes
          </p>
        )}
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12 max-w-7xl mx-auto">
        {/* LEFT: JD PREVIEW */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <h2 className="text-2xl font-bold text-[#053245] mb-5">
            📄 Job Description Preview
          </h2>

          {!jdText ? (
            <p className="text-gray-500 italic text-lg mt-6">
              Job description content here...
            </p>
          ) : (
            <div className="space-y-6">
              {/* JD Text */}
              <div className="max-h-[400px] overflow-y-auto pr-2 text-gray-700 leading-relaxed text-sm">
                <p className="whitespace-pre-wrap">{jdText}</p>
              </div>

              {/* Keywords */}
              {jdKeywords && jdKeywords.length > 0 && (
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

        {/* RIGHT: MATCHING RESUMES */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <h2 className="text-2xl font-bold text-[#053245] mb-5">
            👥 Matching Resumes
          </h2>

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
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-[#073C4D]">
                        {resume.candidate_name || "Unknown"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {resume.email || "No email"}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        resume.match_percentage >= 70
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
                    <strong>Experience:</strong> {resume.experience_years || 0}{" "}
                    years
                  </p>

                  {/* Matched Skills */}
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-green-700 mb-1">
                      ✓ Matched Skills:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(resume.matched_skills || []).slice(0, 5).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                      {(resume.matched_skills || []).length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          +{(resume.matched_skills || []).length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Missing Skills */}
                  {(resume.missing_skills || []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1">
                        ✗ Missing Skills:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(resume.missing_skills || [])
                          .slice(0, 5)
                          .map((skill, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs"
                            >
                              {skill}
                            </span>
                          ))}
                        {(resume.missing_skills || []).length > 5 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{(resume.missing_skills || []).length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* View Button */}
                  {/* ✅ FIXED: Corrected onClick to pass the resume object */}
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
        </div>
      </div>

      {/* MODAL (Kept in code, but unused for new tab view) */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => {
            setShowModal(false);
            setSelectedResumeUrl("");
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold text-[#053245]">
                {selectedResumeName}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedResumeUrl("");
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {selectedResumeUrl ? (
                <iframe
                  src={selectedResumeUrl}
                  className="w-full h-full border-0"
                  title={selectedResumeName}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Loading resume...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDescriptionMatch;