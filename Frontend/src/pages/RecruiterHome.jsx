import React from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  SearchCheck,
  BarChart3,
  FolderOpen,
  Home,        // ⭐ NEW ICON (Lucide React)
} from "lucide-react";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
 
const RecruiterHome = () => {
  const navigate = useNavigate();
 
  const menuItems = [
    {
      title: "Add New Candidate",
      icon: <UserPlus />,
      desc: "Upload and add a candidate profile to the system.",
      link: "/upload",
    },
    {
      title: "Search Profiles",
      icon: <SearchCheck />,
      desc: "Find resumes using intelligent AI matching.",
      link: "/retrieve",
    },
    {
      title: "Insights & Analytics",
      icon: <BarChart3 />,
      desc: "View hiring metrics and recruitment statistics.",
      link: "/recruiterdashboard",
    },
    {
      title: "Resume Library",
      icon: <FolderOpen />,
      desc: "Browse, edit and organize all uploaded resumes.",
      link: "/manageresume",
    },
    {
      title: "JD Matcher",
      icon: <SearchCheck />,
      desc: "Match resumes with any uploaded Job Description.",
      link: "/jobdescriptionmatch",
    },
  ];
 
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#F5F9FC] via-[#ECF3F6] to-[#E6F0F5]">
 
      {/* ================== NEW UNIFIED SIDEBAR ================== */}
      <RecruiterSidebar active="Home" />
 
      {/* ================== MAIN CONTENT ================== */}
      <main className="flex-1 ml-72 p-12 overflow-y-auto relative">
 
        {/* ⭐ UPDATED HOME BUTTON TO MATCH YOUR SCREENSHOT EXACTLY */}
        <button
          onClick={() => navigate("/")}
          className="
            absolute top-10 right-10
            flex items-center gap-3
            px-8 py-3
            rounded-full
            bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
            text-white font-semibold
            shadow-xl
            hover:shadow-2xl hover:scale-[1.04]
            transition-all duration-300
          "
        >
          <Home size={22} className="text-white" />  {/* ⭐ ICON EXACTLY LIKE SCREENSHOT */}
         
        </button>
 
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-[0.07] pointer-events-none"></div>
 
        {/* Actual Page */}
        <div className="relative z-10 max-w-7xl mx-auto">
 
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-extrabold text-[#0C1C26] flex items-center gap-2">
              Welcome, Recruiter <span className="text-4xl animate-wave">👋</span>
            </h1>
            <p className="text-gray-600 mt-2 text-[15px]">
              Manage your entire recruitment workflow — upload, search, analyze, and organize resumes effortlessly.
            </p>
          </div>
 
          {/* Cards Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {menuItems.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(item.link)}
                className="
                  cursor-pointer p-7 rounded-2xl bg-white border border-gray-200
                  hover:shadow-xl hover:-translate-y-2
                  transition-all duration-300 group
                "
              >
                {/* Icon Box */}
                <div
                  className="
                    w-16 h-16 rounded-xl bg-[#F1F5F9]
                    flex items-center justify-center
                    text-[#073C4D] shadow-sm
                    group-hover:bg-[#E5EDF4]
                    transition-all
                  "
                >
                  {React.cloneElement(item.icon, { size: 32 })}
                </div>
 
                {/* Title */}
                <h3 className="text-xl font-semibold text-[#0D1F29] mt-5">
                  {item.title}
                </h3>
 
                {/* Description */}
                <p className="text-gray-600 text-sm mt-2">{item.desc}</p>
              </div>
            ))}
          </div>
 
          {/* Footer */}
        </div>
      </main>
    </div>
  );
};
 
export default RecruiterHome;
 
 
 