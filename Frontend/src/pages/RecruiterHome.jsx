import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Search,
  LayoutDashboard,
  FileText,
  UserPlus,
  SearchCheck,
  BarChart3,
  FolderOpen
} from "lucide-react";
import "bootstrap-icons/font/bootstrap-icons.css";
 
const RecruiterHome = () => {
  const navigate = useNavigate();
 
  // ⭐ Updated menuItems with JD Matcher
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
 
      {/* ================= SIDEBAR ================= */}
      <aside className="w-80 bg-gradient-to-b from-[#073C4D] to-[#19A8B6] text-white flex flex-col shadow-xl relative">
       
        {/* Sidebar Header */}
        <div className="p-7 border-b border-white/10">
          <h2 className="text-2xl font-bold tracking-wide">Recruiter Panel</h2>
          <p className="text-sm text-teal-100 mt-1">Quick Navigation</p>
        </div>
 
        {/* Sidebar Buttons */}
        <div className="flex-1 p-6 overflow-y-auto pb-40 space-y-3">
          <SidebarItem icon={<Upload size={18} />} label="Upload" link="/upload" navigate={navigate} />
          <SidebarItem icon={<Search size={18} />} label="Retrieve" link="/retrieve" navigate={navigate} />
          <SidebarItem icon={<LayoutDashboard size={18} />} label="Dashboard" link="/recruiterdashboard" navigate={navigate} />
          <SidebarItem icon={<FileText size={18} />} label="Manage Resume" link="/manageresume" navigate={navigate} />
        </div>
 
        {/* Profile */}
        <div className="fixed bottom-0 left-0 w-80 p-5 bg-gradient-to-b from-[#073C4D]/95 to-[#19A8B6]/95 border-t border-white/10 flex items-center gap-3 shadow-xl">
          <img
            src="https://randomuser.me/api/portraits/women/68.jpg"
            alt="Recruiter"
            className="w-11 h-11 rounded-full border-2 border-white/80 shadow-lg"
          />
          <div>
            <p className="font-semibold">Emma Johnson</p>
            <p className="text-sm text-teal-100">Recruiter</p>
          </div>
        </div>
      </aside>
 
      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 p-12 overflow-y-auto relative">
 
        {/* Floating Home Button */}
        <button
          onClick={() => navigate("/recruiterhome")}
          className="absolute top-10 right-10 flex items-center gap-2 px-7 py-3 rounded-full
                     bg-gradient-to-r from-[#073C4D] to-[#1AB8C0] text-white font-semibold
                     shadow-lg hover:shadow-2xl hover:scale-[1.04] transition-all duration-300"
        >
          <i className="bi bi-house-door-fill text-lg"></i>
          Home
        </button>
 
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-[0.07] pointer-events-none"></div>
 
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
 
          {/* ================= CARDS SECTION ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
           
            {menuItems.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(item.link)}
                className="cursor-pointer p-7 rounded-2xl bg-white border border-gray-200
                           hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group"
              >
               
                {/* Icon Box */}
                <div className="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center
                                text-[#073C4D] shadow-sm group-hover:bg-[#E5EDF4] transition-all">
                  {React.cloneElement(item.icon, { size: 32 })}
                </div>
 
                {/* Title */}
                <h3 className="text-xl font-semibold text-[#0D1F29] mt-5">{item.title}</h3>
 
                {/* Description */}
                <p className="text-gray-600 text-sm mt-2">{item.desc}</p>
              </div>
            ))}
 
          </div>
 
          {/* Footer */}
          <footer className="mt-16 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Recruiter Portal • All rights reserved
          </footer>
        </div>
      </main>
    </div>
  );
};
 
const SidebarItem = ({ icon, label, link, navigate }) => (
  <button
    onClick={() => navigate(link)}
    className="flex items-center gap-4 p-3 w-full text-lg font-medium
               rounded-xl hover:bg-white/20 hover:translate-x-1 transition-all"
  >
    {icon}
    {label}
  </button>
);
 
export default RecruiterHome;
 
 