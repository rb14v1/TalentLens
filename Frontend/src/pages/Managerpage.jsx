import React, { useState, useEffect } from "react";
import { BarChart3, FileText, Users } from "lucide-react";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
 
function Managerpage() {
  const [published, setPublished] = useState([]);
 
  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    setPublished(items);
  }, []);
 
  return (
    <div className="min-h-screen flex bg-[#E9F1F4]">
 
      {/* ⬅️ Hiring Manager Sidebar */}
      <HiringManagerSidebar jds={published} />
 
      {/* MAIN CONTENT */}
      <main
        className="flex-1 ml-72 p-10 relative
                   bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4]"
      >
 
        {/* Background pattern */}
        <div
          className="absolute inset-0
          bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')]
          opacity-10 pointer-events-none"
        ></div>
 
        <div className="max-w-6xl mx-auto relative z-10">
 
          {/* HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#0D1F29]">Manager Overview</h1>
            <p className="text-gray-600 mt-2">
              Monitor hiring activities, job postings, and candidate engagement at a glance.
            </p>
          </div>
 
          {/* CARDS */}
          <div className="grid grid-cols-3 gap-8 mt-8">
 
            {/* JD Overview */}
            <div className="bg-white shadow-md rounded-2xl p-6 border hover:shadow-lg transition">
              <BarChart3 size={34} className="text-[#0F394D] mb-3" />
              <h3 className="text-xl font-semibold">JD Overview</h3>
              <p className="text-gray-500 mt-1 text-sm">
                Review statistics and activity on active job descriptions.
              </p>
            </div>
 
            {/* Active Positions */}
            <div className="bg-white shadow-md rounded-2xl p-6 border hover:shadow-lg transition">
              <FileText size={34} className="text-[#0F394D] mb-3" />
              <h3 className="text-xl font-semibold">Active Positions</h3>
              <p className="text-gray-500 mt-1 text-sm">
                Track open positions and their current recruitment stages.
              </p>
            </div>
 
            {/* Candidate Insights */}
            <div className="bg-white shadow-md rounded-2xl p-6 border hover:shadow-lg transition">
              <Users size={34} className="text-[#0F394D] mb-3" />
              <h3 className="text-xl font-semibold">Candidate Insights</h3>
              <p className="text-gray-500 mt-1 text-sm">
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
 
 
 