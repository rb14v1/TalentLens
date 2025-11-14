import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Grid,
  Layers,
  Briefcase,
  ChevronDown,
  ChevronRight,
  LogOut,
  BarChart3,
  FileText,
  Users,
} from "lucide-react";

function Managerpage() {
  const navigate = useNavigate();
  const [openAllJDs, setOpenAllJDs] = useState(false);
  const [published, setPublished] = useState([]);

  const currentUser = {
    name: "Alex Green",
    role: "Engineering Manager",
    department: "Engineering / IT",
  };

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    setPublished(items);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#E9F1F4]">
      {/* Sidebar */}
      <aside className="relative w-80 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg">
        {/* Empty space (reserved) */}
        <div className="p-6 border-b border-[#1CA9A3]/30 h-[90px] flex items-center justify-center"></div>

        {/* Navigation Section */}
        <nav className="flex-1 p-4 overflow-y-auto pb-32">
          <h3 className="text-xs uppercase text-teal-200 font-semibold mb-3">
            Navigation
          </h3>
          <ul className="space-y-2 mb-6">
            <li
              onClick={() => navigate("/managerdashboard")}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#ffffff]/10 transition-all"
            >
              <Grid size={18} /> <span>JD Dashboard</span>
            </li>

            <li
              onClick={() => navigate("/description")}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#ffffff]/10 transition-all"
            >
              <Layers size={18} /> <span>Manual JD Create</span>
            </li>

            <li
              onClick={() => navigate("/resume")}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-[#ffffff]/10 transition-all"
            >
              <Briefcase size={18} /> <span>Resume</span>
            </li>
          </ul>

          <h3 className="text-xs uppercase text-teal-200 font-semibold mb-3">
            All JDs
          </h3>
          <div
            className="bg-[#ffffff]/10 hover:bg-[#ffffff]/20 rounded-lg p-3 transition-all cursor-pointer"
            onClick={() => setOpenAllJDs(!openAllJDs)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Briefcase size={16} />
                <span className="text-sm font-semibold">Published JDs</span>
              </div>
              {openAllJDs ? (
                <ChevronDown size={14} className="text-teal-100" />
              ) : (
                <ChevronRight size={14} className="text-teal-100" />
              )}
            </div>

            {openAllJDs && (
              <ul className="ml-7 mt-2 text-teal-100 text-xs space-y-1">
                {published.length ? (
                  published.map((p) => (
                    <li
                      key={p.id}
                      className="hover:text-white cursor-pointer transition-colors"
                    >
                      • {p.jobTitle}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-teal-100">No published JDs</li>
                )}
              </ul>
            )}
          </div>
        </nav>

        {/* Fixed Bottom Profile Section */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-[#1CA9A3]/30 bg-gradient-to-b from-[#0F394D]/90 to-[#21B0BE]/90 backdrop-blur-sm flex items-center gap-3 shadow-[0_-2px_8px_rgba(0,0,0,0.2)]">
          <img
            src="https://randomuser.me/api/portraits/men/65.jpg"
            alt="User"
            className="w-10 h-10 rounded-full border-2 border-white/70"
          />
          <div className="flex-1">
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-sm text-teal-100">{currentUser.role}</p>
          </div>
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto p-10 bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4]">
        {/* Abstract SVG Background */}
        <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-10 pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Professional Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#0D1F29]">
              Manager Overview
            </h1>
            <p className="text-gray-600 mt-2">
              Monitor hiring activities, job postings, and candidate engagement
              at a glance.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-6 mt-6">
            <div className="bg-white/80 backdrop-blur-md shadow-md rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all">
              <BarChart3 size={32} className="text-[#0F394D] mb-3" />
              <h4 className="text-lg font-semibold text-gray-800">
                JD Overview
              </h4>
              <p className="text-gray-500 text-sm mt-1">
                Review statistics and activity on active job descriptions.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md shadow-md rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all">
              <FileText size={32} className="text-[#0F394D] mb-3" />
              <h4 className="text-lg font-semibold text-gray-800">
                Active Positions
              </h4>
              <p className="text-gray-500 text-sm mt-1">
                Track open positions and their current recruitment stages.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-md shadow-md rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all">
              <Users size={32} className="text-[#0F394D] mb-3" />
              <h4 className="text-lg font-semibold text-gray-800">
                Candidate Insights
              </h4>
              <p className="text-gray-500 text-sm mt-1">
                View shortlisted candidates and resume engagement analytics.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Managerpage;
