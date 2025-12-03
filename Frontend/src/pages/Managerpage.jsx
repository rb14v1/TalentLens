// src/pages/Managerpage.jsx
 
import React, { useState, useEffect } from "react";
import { BarChart3, FileText, Users } from "lucide-react";
 
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";
import { useNavigate } from "react-router-dom";
 
function Managerpage() {
  const [published, setPublished] = useState([]);
  const [collapsed, setCollapsed] = useState(true);
 
  const navigate = useNavigate(); // ⭐ Added
 
  useEffect(() => {
    const items = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    setPublished(items);
  }, []);
 
  return (
    <div className="min-h-screen flex flex-col bg-[#E9F1F4]">
 
      {/* ⭐ GLOBAL HEADER */}
      <GlobalHeader />
 
      {/* ⭐ CONTENT BELOW HEADER */}
      <div className="flex flex-1 pt-[24px]">
 
        {/* ⭐ SIDEBAR */}
        <HiringManagerSidebar
          setCollapsed={setCollapsed}
          jds={published}
          style={{ marginTop: "72px" }}
        />
 
        {/* ⭐ MAIN CONTENT */}
        <main
          className="
            flex-1
            p-6 sm:p-8 md:p-10
            overflow-y-auto
            transition-all
            relative
          "
          style={{ marginLeft: collapsed ? "5rem" : "18rem" }}
        >
 
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-[0.07] pointer-events-none"></div>
 
          {/* PAGE CONTENT */}
          <div className="relative z-10 max-w-7xl mx-auto">
 
            {/* PAGE HEADER */}
            <div className="mb-10 mt-4">
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C1C26]">
                Hiring Manager Overview
              </h1>
              <p className="text-gray-600 mt-2 text-[14px] md:text-[15px]">
                Monitor hiring activities, jd postings, and resume management at a glance.
              </p>
            </div>
 
            {/* DASHBOARD CARDS */}
            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-2
                md:grid-cols-2
                lg:grid-cols-3
                gap-6
                md:gap-8
                lg:gap-10
              "
            >
 
              {/* ⭐ Manual JD Create → Navigate */}
              <div
                onClick={() => navigate("/description")}
                className="
                  cursor-pointer
                  p-6 md:p-7
                  rounded-2xl
                  bg-white
                  border border-gray-200
                  hover:shadow-xl hover:-translate-y-2
                  transition-all duration-300 group
                "
              >
                <div
                  className="
                    w-14 h-14 md:w-16 md:h-16
                    rounded-xl bg-[#F1F5F9]
                    flex items-center justify-center
                    text-[#073C4D] shadow-sm
                    group-hover:bg-[#E5EDF4]
                    transition-all
                  "
                >
                  <BarChart3 size={30} />
                </div>
 
                <h3 className="text-lg md:text-xl font-semibold text-[#0D1F29] mt-5">
                  Manual JD Create
                </h3>
 
                <p className="text-gray-600 text-sm mt-2">
                  Create JD's in a form based interface.
                </p>
              </div>
 
              {/* ⭐ Draft → Navigate */}
              <div
                onClick={() => navigate("/drafts")}
                className="
                  cursor-pointer
                  p-6 md:p-7
                  rounded-2xl
                  bg-white
                  border border-gray-200
                  hover:shadow-xl hover:-translate-y-2
                  transition-all duration-300 group
                "
              >
                <div
                  className="
                    w-14 h-14 md:w-16 md:h-16
                    rounded-xl bg-[#F1F5F9]
                    flex items-center justify-center
                    text-[#073C4D] shadow-sm
                    group-hover:bg-[#E5EDF4]
                    transition-all
                  "
                >
                  <FileText size={30} />
                </div>
 
                <h3 className="text-lg md:text-xl font-semibold text-[#0D1F29] mt-5">
                  Draft
                </h3>
 
                <p className="text-gray-600 text-sm mt-2">
                  Check previously saved jd-drafts.
                </p>
              </div>
 
              {/* ⭐ Published JDs → Navigate */}
              <div
                onClick={() => navigate("/published-jds")}
                className="
                  cursor-pointer
                  p-6 md:p-7
                  rounded-2xl
                  bg-white
                  border border-gray-200
                  hover:shadow-xl hover:-translate-y-2
                  transition-all duration-300 group
                "
              >
                <div
                  className="
                    w-14 h-14 md:w-16 md:h-16
                    rounded-xl bg-[#F1F5F9]
                    flex items-center justify-center
                    text-[#073C4D] shadow-sm
                    group-hover:bg-[#E5EDF4]
                    transition-all
                  "
                >
                  <Users size={30} />
                </div>
 
                <h3 className="text-lg md:text-xl font-semibold text-[#0D1F29] mt-5">
                  Published JDs
                </h3>
 
                <p className="text-gray-600 text-sm mt-2">
                  View finalised and published JD's.
                </p>
              </div>
 
              {/* ⭐ Matched Resume → Navigate */}
              <div
                onClick={() => navigate("/matchedresume")}
                className="
                  cursor-pointer
                  p-6 md:p-7
                  rounded-2xl
                  bg-white
                  border border-gray-200
                  hover:shadow-xl hover:-translate-y-2
                  transition-all duration-300 group
                "
              >
                <div
                  className="
                    w-14 h-14 md:w-16 md:h-16
                    rounded-xl bg-[#F1F5F9]
                    flex items-center justify-center
                    text-[#073C4D] shadow-sm
                    group-hover:bg-[#E5EDF4]
                    transition-all
                  "
                >
                  <Users size={30} />
                </div>
 
                <h3 className="text-lg md:text-xl font-semibold text-[#0D1F29] mt-5">
                  Matched Resume
                </h3>
 
                <p className="text-gray-600 text-sm mt-2">
                  View matched resumes with percentage and insights.
                </p>
              </div>
 
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
 
export default Managerpage;
 
 