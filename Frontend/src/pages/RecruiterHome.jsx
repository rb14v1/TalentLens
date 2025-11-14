import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  Search,
  LayoutDashboard,
  FileText,
} from "lucide-react";
import "bootstrap-icons/font/bootstrap-icons.css";

const RecruiterHome = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: "Upload Resume",
      icon: <Upload size={40} />,
      desc: "Upload candidate resumes for parsing and analysis.",
      link: "/upload",
    },
    {
      title: "Retrieve",
      icon: <Search size={40} />,
      desc: "Retrieve and search resumes using AI-based matching.",
      link: "/retrieve",
    },
    {
      title: "Dashboard",
      icon: <LayoutDashboard size={40} />,
      desc: "View recruitment statistics and analytics overview.",
      link: "/recruiterdashboard",
    },
    {
      title: "Manage Resume",
      icon: <FileText size={40} />,
      desc: "Edit, delete, and manage uploaded resumes.",
      link: "/manageresume",
    },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4]">
      
      {/* ===== Sidebar ===== */}
      <aside className="w-80 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg relative">
        {/* Header */}
        <div className="p-6 border-b border-[#1CA9A3]/30">
          <h2 className="text-2xl font-semibold">Recruiter Panel</h2>
          <p className="text-sm text-teal-100 mt-1">Quick Navigation</p>
        </div>

        {/* Sidebar Links */}
        <div className="flex-1 p-5 overflow-y-auto pb-28 space-y-3">
          <button onClick={() => navigate("/upload")} className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"><Upload size={18}/>Upload</button>
          <button onClick={() => navigate("/retrieve")} className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"><Search size={18}/>Retrieve</button>
          <button onClick={() => navigate("/recruiterdashboard")} className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"><LayoutDashboard size={18}/>Dashboard</button>
          <button onClick={() => navigate("/manageresume")} className="flex items-center gap-3 p-2 w-full rounded-lg hover:bg-white/20 transition-all"><FileText size={18}/>Manage Resume</button>
        </div>

        {/* Profile */}
        <div className="fixed bottom-0 left-0 w-80 p-5 border-t border-[#1CA9A3]/30 bg-gradient-to-b from-[#0F394D]/95 to-[#21B0BE]/95 flex items-center gap-3">
          <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="Recruiter" className="w-10 h-10 rounded-full border-2 border-white/70"/>
          <div className="flex-1">
            <p className="font-semibold">Emma Johnson</p>
            <p className="text-sm text-teal-100">Recruiter</p>
          </div>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="flex-1 p-10 overflow-y-auto relative">
        
        {/* 🔹Professional Home Button (Top-Right) */}
        <button
          onClick={() => navigate("/recruiterhome")}
          className="absolute top-8 right-8 flex items-center gap-2 px-6 py-2.5 rounded-full
                     bg-gradient-to-r from-[#0F394D] to-[#1FB9C0] text-white font-medium
                     shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300 z-20"
        >
          <i className="bi bi-house-door-fill text-lg"></i>
          Home
        </button>

        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-10 pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto">

          {/* 🌟 Refined Welcome Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-[#0D1F29] tracking-tight flex items-center gap-2">
              Welcome, Recruiter 
              <span className="text-4xl origin-bottom animate-wave">👋</span>
            </h1>

            <p className="text-gray-600 text-[15px] mt-2 leading-relaxed">
              Manage your entire recruitment workflow — upload, retrieve, and analyze resumes with ease.
            </p>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(item.link)}
                className="cursor-pointer bg-white rounded-2xl shadow-md hover:shadow-lg 
                           border border-gray-100 hover:-translate-y-1 transition-all"
              >
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white p-4 rounded-full mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-[#0D1F29] mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-16 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Recruiter Portal • All rights reserved
          </div>

        </div>
      </main>
    </div>
  );
};

export default RecruiterHome;
