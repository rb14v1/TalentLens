// Frontend/src/pages/AnalyticsDetails.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

const AnalyticsDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Get data from React Router state (passed from dashboard)
  const stateData = location.state || {};
  const { type, name, value, raw } = stateData;

  // ✅ Also support URL query params (backward compatibility)
  const params = new URLSearchParams(location.search);
  const cpd_level = params.get("cpd_level") || raw;
  const experience = params.get("experience") || (type === "experience" ? name : null);
  const skill = params.get("skill") || (type === "skill" ? name : null);

  useEffect(() => {
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        
        // Build query based on type
        if (type === "cpd" || cpd_level) {
          q.append("cpd_level", cpd_level || raw);
        }
        if (type === "experience" || experience) {
          q.append("experience", experience || name);
        }
        if (type === "skill" || skill) {
          q.append("skill", skill || name);
        }

        const url = `${API_BASE_URL}/analytics/filter?${q.toString()}`;
        const res = await fetch(url);
        const data = await res.json();

        const items = data.results ?? data.data ?? data.items ?? [];
        setResumes(items);
      } catch (err) {
        console.error("Error fetching filtered resumes:", err);
        setResumes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiltered();
  }, [type, name, raw, cpd_level, experience, skill]);

  // ✅ IMPROVED: Better title formatting based on type
  const getTitle = () => {
    if (type === "cpd") {
      return `CPD ${name}`;
    } else if (type === "experience") {
      return `Experience: ${name}`;
    } else if (type === "skill") {
      return name; // Just the skill name (e.g., "Python", "React")
    } else if (cpd_level) {
      return `CPD Level ${cpd_level}`;
    } else if (experience) {
      return experience;
    } else if (skill) {
      return skill;
    }
    return "Filtered";
  };

  const title = getTitle();
  const subtitle = value ? `${value} ${value === 1 ? 'candidate' : 'candidates'}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4] p-10">
      <div className="max-w-7xl mx-auto">
        
        {/* ✅ ENHANCED HEADER with Badge */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold text-[#0F394D]">
                {title}
              </h1>
              {subtitle && (
                <span className="px-4 py-2 bg-gradient-to-r from-[#21B0BE] to-[#4DD0E1] 
                               text-white text-sm font-semibold rounded-full shadow-lg">
                  {subtitle}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-lg">
              Matching resumes for this filter
            </p>
          </div>

          {/* BACK BUTTON */}
          <button
            onClick={() => navigate(-1)}
            className="
              px-8 py-3 
              text-white font-semibold
              bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
              rounded-full shadow-lg 
              hover:shadow-xl hover:scale-105
              transition-all duration-300
            "
          >
            Back
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="flex justify-center items-center mt-32">
            <div className="w-16 h-16 border-4 border-[#21B0BE] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : resumes.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">
              No Resumes Found
            </h2>
            <p className="text-gray-500">
              No candidates match this filter criteria.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white">
                  <tr>
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">CPD Level</th>
                    <th className="p-4 font-semibold">Skills</th>
                    <th className="p-4 font-semibold">Experience</th>
                    <th className="p-4 font-semibold">Resume</th>
                  </tr>
                </thead>

                <tbody>
                  {resumes.map((r, idx) => {
                    const name =
                      r.name ??
                      r.candidate_name ??
                      r.candidateName ??
                      r.full_name ??
                      "Unknown";

                    const cpd =
                      r.cpd_level ?? r.cpd ?? r.cpdLevel ?? "N/A";

                    const skills =
                      r.skills ?? r.skill_list ?? r.skills_list ?? [];

                    const experienceVal =
                      r.experience ??
                      r.experience_years ??
                      r.experience_range ??
                      "Unknown";

                    const fileName =
                      r.file_name ??
                      r.readable_file_name ??
                      r.s3_path?.split("/").pop() ??
                      r.s3_url?.split("/").pop() ??
                      "";

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 hover:bg-[#21B0BE]/5 transition-colors"
                      >
                        <td className="p-4 font-semibold text-[#0F394D]">
                          {name}
                        </td>

                        <td className="p-4">
                          <span className="px-4 py-2 rounded-lg text-sm font-semibold
                                         bg-[#21B0BE]/20 text-[#0F394D]">
                            {cpd}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex flex-wrap gap-2 max-w-md">
                            {Array.isArray(skills) && skills.length > 0 ? (
                              skills.slice(0, 10).map((s, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1 text-xs font-medium
                                           bg-[#21B0BE]/10 text-[#0F394D] 
                                           rounded-full border border-[#21B0BE]/20"
                                >
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400 italic">
                                No skills listed
                              </span>
                            )}
                            {skills.length > 10 && (
                              <span className="text-xs text-gray-500 self-center">
                                +{skills.length - 10} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-[#0F394D] font-medium">
                          {experienceVal}
                        </td>

                        <td className="p-4">
                          {/* ✅ FIXED VIEW RESUME BUTTON */}
                          <button
                            className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
                                     text-white px-5 py-2 rounded-lg font-medium
                                     shadow-md hover:shadow-lg hover:scale-105
                                     transition-all duration-300"
                            onClick={() => {
                              if (!fileName) {
                                alert("No file name available for this resume");
                                return;
                              }
                              // ✅ Open backend URL directly (same as other pages)
                              const url = `${API_BASE_URL}/view_resume/?file_name=${encodeURIComponent(fileName)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            View Resume
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDetails;
