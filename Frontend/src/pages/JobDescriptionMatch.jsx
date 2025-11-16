import React, { useState } from "react";
import { Upload, Search, ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const JobDescriptionMatch = () => {
  const navigate = useNavigate();

  const [jdFile, setJdFile] = useState(null);
  const [jobDescription, setJobDescription] = useState(null);
  const [matchingResumes, setMatchingResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [jdKeywords, setJdKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => setJdFile(e.target.files[0]);

  // ✅ NEW: Handle view resume function
  const handleViewResume = async (resume) => {
    try {
      // Use file_name from the resume data
      const fileName = resume.file_name || 'Unknown.pdf';
      
      if (!fileName) {
        alert("No file name available for this resume!");
        return;
      }

      // Call backend to get presigned URL
      const response = await fetch(`http://localhost:8000/view_resume/?file_name=${encodeURIComponent(fileName)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get resume: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Open the PDF in a new tab
      if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.presigned_url) {
        window.open(data.presigned_url, '_blank');
      } else {
        alert("Could not retrieve PDF URL");
      }
    } catch (err) {
      console.error("Error viewing resume:", err);
      alert("Failed to view resume: " + err.message);
    }
  };

  const handleMatchResumes = async () => {
    if (!jdFile) return setError("Please upload a Job Description file.");
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("jd_file", jdFile);

      // ✅ Updated: Call the correct endpoint
      const matchResponse = await fetch("http://localhost:8000/jd_match/", {
        method: "POST",
        body: formData,
      });

      if (!matchResponse.ok) {
        throw new Error(`Failed to match resumes: ${matchResponse.statusText}`);
      }

      const matchData = await matchResponse.json();

      // ✅ Updated: Match new backend response format
      setMatchingResumes(matchData.matches || []);
      setJdKeywords(matchData.jd_keywords || []);
      
      if (matchData.matches && matchData.matches.length > 0) {
        setSelectedResume(matchData.matches[0]);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E1F0F4] to-[#F7FBFC] p-12 relative">

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 right-6 flex items-center gap-2 px-6 py-2.5 rounded-full
        bg-gradient-to-r from-[#073C4D] to-[#18A9B7] text-white font-medium
        shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      {/* HEADER */}
      <div className="text-center">
        <h1 className="text-5xl font-extrabold text-[#053245] tracking-tight">
          Job Description Match
        </h1>
        <p className="text-gray-600 mt-3 text-lg">
          Upload a JD and let the AI match it against your resume library.
        </p>
      </div>

      {/* UPLOAD BOX */}
      <div className="max-w-3xl mx-auto mt-10 bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Upload Button */}
          <label className="cursor-pointer flex items-center gap-3 text-[#073C4D] bg-[#F3FAFC] px-6 py-3 rounded-xl border border-gray-300 hover:bg-[#E9F5F7] transition shadow-sm w-full sm:w-auto">
            <Upload size={22} />
            <span>{jdFile ? jdFile.name : "Choose Job Description File"}</span>
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
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white font-semibold shadow-md hover:shadow-xl hover:scale-[1.03] disabled:opacity-50 transition flex items-center gap-2"
          >
            <Search size={20} />
            {loading ? "Matching..." : "Match Resumes"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {error && <p className="text-center mt-4 text-red-600 font-semibold">{error}</p>}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-14">

        {/* ============ LEFT PANEL: MATCH SCORE + KEYWORDS ============ */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">

          {/* MATCH SCORE */}
          {selectedResume && (
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-[#073C4D] mb-3">
                {selectedResume.match_percentage}% Match
              </h2>

              <div className="w-full h-3 bg-gray-200 rounded-full mt-3">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"
                  style={{ width: `${selectedResume.match_percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* MATCHED KEYWORDS */}
          <h3 className="text-lg font-bold text-[#073C4D] mb-3 flex items-center gap-2">
            <CheckCircle className="text-green-600" /> Matched Keywords ({selectedResume?.matched_skills.length || 0})
          </h3>

          {selectedResume && selectedResume.matched_skills.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-8">
              {selectedResume.matched_skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 mb-8">No matched keywords yet...</p>
          )}

          {/* UNMATCHED KEYWORDS */}
          <h3 className="text-lg font-bold text-[#073C4D] mb-3 flex items-center gap-2">
            <XCircle className="text-red-600" /> Missing Keywords ({selectedResume?.missing_skills.length || 0})
          </h3>

          {selectedResume && selectedResume.missing_skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedResume.missing_skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No missing keywords yet...</p>
          )}
        </div>

        {/* ============ RIGHT PANEL: RESUME PREVIEW ============ */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">

          <h3 className="text-2xl font-bold text-[#053245] mb-5">
            Resume Preview
          </h3>

          {!selectedResume ? (
            <p className="text-gray-500 italic">No resume selected…</p>
          ) : (
            <div className="space-y-4 text-gray-700">

              <div>
                <h2 className="text-xl font-bold text-[#073C4D]">{selectedResume.candidate_name}</h2>
                <p>{selectedResume.email}</p>
              </div>

              <div>
                <h4 className="font-bold text-[#053245]">Experience:</h4>
                <p>{selectedResume.experience_years} years</p>
              </div>

              <div>
                <h4 className="font-bold text-[#053245]">Skills:</h4>
                <p className="text-sm">{selectedResume.skills?.join(", ") || "N/A"}</p>
              </div>

              {/* ✅ NEW: View Resume Button */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => handleViewResume(selectedResume)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white rounded-lg font-semibold hover:shadow-lg transition"
                >
                  📄 View Full Resume
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* MATCHING RESULTS TABLE */}
      {matchingResumes.length > 0 && (
        <div className="max-w-7xl mx-auto mt-14 bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <h3 className="text-2xl font-bold text-[#053245] mb-6">
            👥 Matching Resumes ({matchingResumes.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F3FAFC] border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Experience</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Match %</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Matched Skills</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Missing Skills</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[#073C4D]">Action</th>
                </tr>
              </thead>
              <tbody>
                {matchingResumes.map((resume, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-100 hover:bg-[#F9FDFE] transition cursor-pointer ${
                      selectedResume?.id === resume.id ? "bg-[#E9F5F7]" : ""
                    }`}
                    onClick={() => setSelectedResume(resume)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{resume.candidate_name}</td>
                    <td className="px-4 py-3 text-gray-700">{resume.email}</td>
                    <td className="px-4 py-3 text-gray-700">{resume.experience_years} yrs</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        resume.match_percentage >= 70
                          ? "bg-green-100 text-green-700"
                          : resume.match_percentage >= 50
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {resume.match_percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {resume.matched_skills.slice(0, 2).map((skill, i) => (
                          <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {resume.matched_skills.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            +{resume.matched_skills.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {resume.missing_skills.slice(0, 2).map((skill, i) => (
                          <span key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {resume.missing_skills.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            +{resume.missing_skills.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResume(resume);
                        }}
                        className="px-4 py-1 bg-gradient-to-r from-[#053245] to-[#12A7B3] text-white rounded-lg text-sm font-medium hover:shadow-md transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default JobDescriptionMatch;
