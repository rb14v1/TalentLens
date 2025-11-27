import React, { useState, useEffect } from "react";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
import { FileText, User } from "lucide-react";

const MatchedResume = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [matchedData, setMatchedData] = useState([]);

  useEffect(() => {
    // 🔥 DUMMY DATA (auto loads if localStorage empty)
    const dummyData = [
      {
        jobTitle: "Frontend Developer",
        experience: "2–4 Years",
        summary: "Looking for a React.js developer with UI/UX understanding.",
        resumes: [
          {
            candidateName: "Aarav Sharma",
            experience: "3 Years",
            skills: "React, TailwindCSS, JavaScript",
          },
          {
            candidateName: "Priya Nair",
            experience: "2.5 Years",
            skills: "Next.js, Redux, TypeScript",
          }
        ]
      },

      {
        jobTitle: "Backend Engineer",
        experience: "3–6 Years",
        summary: "Strong Node.js + MongoDB developer required.",
        resumes: [
          {
            candidateName: "Rohit Kumar",
            experience: "5 Years",
            skills: "Node.js, Express, MongoDB",
          },
          {
            candidateName: "Meera Iyer",
            experience: "4 Years",
            skills: "Python, FastAPI, PostgreSQL",
          },
          {
            candidateName: "Siddharth Singh",
            experience: "3 Years",
            skills: "Golang, REST APIs, Kafka",
          }
        ]
      },

      {
        jobTitle: "UI/UX Designer",
        experience: "1–3 Years",
        summary: "Creative designer with Figma & prototyping experience.",
        resumes: [
          {
            candidateName: "Tanvi Rao",
            experience: "2 Years",
            skills: "Figma, Wireframing, Prototyping",
          }
        ]
      }
    ];

    const stored = JSON.parse(localStorage.getItem("matchedResumes") || "[]");

    // If no data in storage → load dummy
    if (!stored || stored.length === 0) {
      localStorage.setItem("matchedResumes", JSON.stringify(dummyData));
      setMatchedData(dummyData);
    } else {
      setMatchedData(stored);
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">

      {/* Sidebar */}
      <HiringManagerSidebar setCollapsed={setCollapsed} />

      {/* Main Content */}
      <main
        className={`flex-1 p-10 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Page Title */}
        <div className="flex items-center justify-center mb-10">
          <h1 className="text-3xl font-bold text-[#0F394D]">
            Matched Resumes
          </h1>
        </div>

        {/* Job -> Resume Matching */}
        <div className="space-y-10">
          {matchedData.length > 0 ? (
            matchedData.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border rounded-3xl shadow-lg p-8"
              >
                {/* Job Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-[#0F394D]">
                    {item.jobTitle}
                  </h2>
                  <p className="text-gray-600 mt-1 text-sm">
                    Experience Required: {item.experience}
                  </p>
                  <p className="text-gray-600 mt-1 text-sm">
                    Summary: {item.summary}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t my-6"></div>

                {/* Resume List */}
                <h3 className="text-xl font-semibold text-[#0F394D] mb-5">
                  Matched Resumes
                </h3>

                {item.resumes && item.resumes.length > 0 ? (
                  item.resumes.map((res, index) => (
                    <div
                      key={index}
                      className="bg-white border shadow p-5 rounded-2xl mb-5 hover:shadow-xl transition"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <User size={28} className="text-[#0F394D]" />

                          <div>
                            <h4 className="text-lg font-semibold text-[#0D1F29]">
                              {res.candidateName}
                            </h4>
                            <p className="text-gray-600 text-sm">
                              Experience: {res.experience}
                            </p>
                            <p className="text-gray-600 text-sm">
                              Skills: {res.skills}
                            </p>
                          </div>
                        </div>

                        <button
                          className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
                                     text-white px-5 py-2 rounded-full shadow hover:opacity-90 transition"
                        >
                          View Resume
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No resumes matched.</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic text-center text-lg">
              No matched resumes available.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default MatchedResume;
