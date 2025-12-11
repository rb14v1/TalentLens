// src/components/sidebar/RecruiterSidebar.jsx
 
import React, { useEffect, useState, useRef } from "react";
import {
  Upload,
  Search,
  LayoutDashboard,
  FileText,
  SearchCheck,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Pencil,
  Briefcase,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config";
 
const RecruiterSidebar = ({ setCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
 
  const getActive = () => {
    if (location.pathname.includes("upload")) return "Upload";
    if (location.pathname.includes("retrieve")) return "Retrieve";
    if (location.pathname.includes("recruiterdashboard")) return "Dashboard";
    if (location.pathname.includes("manageresume")) return "Manage Resume";
    if (location.pathname.includes("jobdescriptionmatch")) return "JD Matcher";
    if (location.pathname.includes("recruiter-jds")) return "All JDs";
    return "";
  };
 
  const [active, setActive] = useState(getActive());
  const [collapsed, setLocalCollapsed] = useState(true);
 
  const [user, setUser] = useState({
    name: "",
    email: "",
    role: "",
    profile_image: "",
  });
 
  useEffect(() => {
    if (setCollapsed) setCollapsed(collapsed);
  }, [collapsed, setCollapsed]);
 
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user"));
    if (stored) {
      setUser({
        name: stored.name || "",
        email: stored.email || "",
        role: stored.role || "Recruiter",
        profile_image: stored.profile_image || "",
      });
    }
  }, []);
 
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
 
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
 
      setUser((prev) => ({ ...prev, profile_image: base64 }));
 
      const stored = JSON.parse(localStorage.getItem("user")) || {};
      stored.profile_image = base64;
      localStorage.setItem("user", JSON.stringify(stored));
 
      try {
        await fetch(`${API_BASE_URL}/upload-profile-image/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: stored.email,
            image: base64,
          }),
        });
      } catch (err) {
        // ignore network error for now
        console.error("Profile image upload failed", err);
      }
    };
    reader.readAsDataURL(file);
  };
 
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
 
  const SidebarItem = ({ icon, label, link }) => {
    const isActive = active === label;
 
    return (
      <button
        onClick={() => {
          setActive(label);
          navigate(link);
        }}
        title={collapsed ? label : ""}
        className={`flex items-center gap-2 px-3 py-2 w-full text-lg font-medium rounded-xl transition-all
          ${isActive ? "text-[#FFFFFF]" : "text-white"}
          ${collapsed ? "justify-center" : ""}`}
      >
        <div
          className={`relative flex items-center justify-center transition-all
            ${collapsed ? "p-1.5" : "p-1"}
            ${isActive ? "bg-white/20 rounded-xl" : "hover:bg-white/15 rounded-xl"}`}
          style={{
            width: collapsed ? 40 : 36,
            height: collapsed ? 40 : 36,
          }}
        >
          <div
            className={`absolute left-0 w-[4px] h-full rounded-r-lg transition-all
              ${isActive ? "bg-white" : "bg-transparent"}`}
          />
          {React.cloneElement(icon, { size: 20, color: "#ffffff" })}
        </div>
 
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </button>
    );
  };
 
  /** SINGLE TOGGLE BUTTON */
  const CompactToggleButton = () => (
    <div className={`flex w-full ${collapsed ? "justify-center" : "justify-end pr-2"}`}>
      <button
        onClick={() => {
          const next = !collapsed;
          setLocalCollapsed(next);
          if (setCollapsed) setCollapsed(next);
        }}
        title={collapsed ? "Open sidebar" : "Close sidebar"}
        className="w-9 h-9 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-shadow shadow-sm"
      >
        {collapsed ? <ChevronRight size={18} color="#fff" /> : <ChevronLeft size={18} color="#fff" />}
      </button>
    </div>
  );
 
  return (
    <>
      {/* ⭐ SIDEBAR BELOW HEADER */}
      <aside
        className={`fixed top-[72px] left-0
          h-[calc(100%-72px)]
          flex flex-col bg-gradient-to-b
          from-[#073C4D] to-[#19A8B6]
          text-white shadow-xl transition-all duration-300
          ${collapsed ? "w-20" : "w-72"}`}
      >
        {/* Toggle Button */}
        <div className="p-3">
          <CompactToggleButton />
        </div>
 
        {/* Navigation */}
        {/* Reduced vertical gap (space-y-2) and reduced paddings in SidebarItem */}
        <div className="px-3 flex-1 space-y-2">
          <SidebarItem label="Upload" icon={<Upload />} link="/upload" />
          <SidebarItem label="Retrieve" icon={<Search />} link="/retrieve" />
          <SidebarItem label="Dashboard" icon={<LayoutDashboard />} link="/recruiterdashboard" />
          <SidebarItem label="Manage Resume" icon={<FileText />} link="/manageresume" />
          <SidebarItem label="JD Matcher" icon={<SearchCheck />} link="/jobdescriptionmatch" />
          <SidebarItem label="All JDs" icon={<Briefcase />} link="/recruiter-jds" />
        </div>
 
        {/* ⭐ PROFILE SECTION — FIX APPLIED HERE ONLY */}
        <div
          className={`${
            collapsed ? "p-3" : "p-5"
          } border-t border-white/10 bg-[#0A4C5E]/90 flex items-center gap-3 transition-all ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="relative">
            <img
              src={user.profile_image || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
              className="w-11 h-11 rounded-full border-2 border-white/80 shadow-lg object-cover"
              alt="profile"
            />
 
            {!collapsed && (
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md"
              >
                <Pencil size={14} className="text-red-500" />
              </button>
            )}
 
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
 
          {!collapsed && (
            <>
              <div className="flex-1">
                <p className="font-semibold text-white">{user.name || "Loading..."}</p>
                <p className="text-xs text-teal-100 truncate">{user.email || "No Email"}</p>
              </div>
 
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="opacity-80 hover:opacity-100"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>
      </aside>
 
      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-80 text-center">
            <h2 className="text-lg font-semibold mb-3 text-gray-800">Confirm Logout</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to logout?</p>
 
            <div className="flex gap-4">
              <button
                className="w-1/2 bg-gray-300 py-2 rounded-lg"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
 
              <button
                className="w-1/2 bg-teal-600 text-white py-2 rounded-lg"
                onClick={() => {
                  localStorage.clear();
                  navigate("/login");
                }}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
 
export default RecruiterSidebar;
 
 