// Frontend/src/pages/AnalyticsDetails.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

const AnalyticsDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  const params = new URLSearchParams(location.search);
  const cpd_level = params.get("cpd_level");
  const experience = params.get("experience");
  const skill = params.get("skill");

  useEffect(() => {
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (cpd_level) q.append("cpd_level", cpd_level);
        if (experience) q.append("experience", experience);
        if (skill) q.append("skill", skill);

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
  }, [cpd_level, experience, skill]);

  const title = cpd_level
    ? `CPD Level ${cpd_level}`
    : experience
    ? `${experience}`
    : skill
    ? `${skill}`
    : "Filtered";

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-10">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[#0F394D]">
            {title} - Matching Resumes
          </h1>

          {/* BACK BUTTON (updated color) */}
          <button
            onClick={() => navigate(-1)}
            className="
              px-6 py-2 
              text-white font-medium
              bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
              rounded-full shadow-md 
              hover:opacity-90
              transition-all duration-300
            "
          >
            Back
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="text-center text-gray-600 mt-20">
            Loading resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="text-center text-gray-600 mt-20">
            No resumes found for this filter.
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[#0F394D] border-b font-semibold">
                  <th className="p-3">Name</th>
                  <th className="p-3">CPD Level</th>
                  <th className="p-3">Skills</th>
                  <th className="p-3">Experience</th>
                  <th className="p-3">Resume</th>
                </tr>
              </thead>

              <tbody>
                {resumes.map((r, idx) => {
                  const name =
                    r.name ??
                    r.candidate_name ??
                    r.candidateName ??
                    r.full_name;

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
                    r.s3_path?.split("/").pop();

                  return (
                    <tr
                      key={idx}
                      className="border-b hover:bg-[#21B0BE]/10 transition"
                    >
                      <td className="p-3 font-semibold text-[#0F394D]">
                        {name}
                      </td>

                      <td className="p-3">
                        <span
                          className="
                            px-3 py-1 
                            rounded-lg text-sm
                            bg-[#21B0BE]/10 text-[#0F394D]
                          "
                        >
                          {cpd}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(skills) && skills.length > 0 ? (
                            skills.map((s, i) => (
                              <span
                                key={i}
                                className="
                                  px-3 py-1 text-sm 
                                  bg-[#21B0BE]/10 text-[#0F394D] 
                                  rounded-full
                                "
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-gray-500">
                              No skills listed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-[#0F394D]">
                        {experienceVal}
                      </td>

                      <td className="p-3">
                        <button
                          className="
                            bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
                            text-white px-4 py-2 rounded-lg 
                            shadow hover:opacity-90 transition
                          "
                          onClick={() =>
                            navigate(
                              `/viewresume?file_name=${encodeURIComponent(
                                fileName || ""
                              )}`
                            )
                          }
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
        )}
      </div>
    </div>
  );
};

export default AnalyticsDetails;
