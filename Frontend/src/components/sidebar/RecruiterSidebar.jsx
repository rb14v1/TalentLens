import React, { useEffect, useState } from "react";
import {
  Upload,
  Search,
  LayoutDashboard,
  FileText,
  SearchCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";
 
const RecruiterSidebar = ({ active = "" }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: "", role: "", profile_image: "" });
 
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile/`, {
          credentials: "include",
        });
        const data = await res.json();
        setUser(data);
      } catch (e) {
        console.log("Profile error:", e);
      }
    };
    load();
  }, []);
 
  return (
    <aside
      className="w-70 fixed top-0 left-0 h-full
                 bg-gradient-to-b from-[#073C4D] to-[#19A8B6]
                 text-white shadow-xl flex flex-col"
    >
      {/* Header */}
      <div className="p-7 border-b border-white/10">
        <h2 className="text-2xl font-bold tracking-wide">Recruiter Panel</h2>
        <p className="text-sm text-teal-100 mt-1">Quick Navigation</p>
      </div>
 
      {/* Menu */}
      <div className="p-6 flex-1 space-y-3">
        <SidebarItem icon={<Upload />} label="Upload" link="/upload" active={active} />
        <SidebarItem icon={<Search />} label="Retrieve" link="/retrieve" active={active} />
        <SidebarItem
          icon={<LayoutDashboard />}
          label="Dashboard"
          link="/recruiterdashboard"
          active={active}
        />
        <SidebarItem
          icon={<FileText />}
          label="Manage Resume"
          link="/manageresume"
          active={active}
        />
        <SidebarItem
          icon={<SearchCheck />}
          label="JD Matcher"
          link="/jobdescriptionmatch"
          active={active}
        />
      </div>
 
      {/* Profile */}
      <div className="p-5 border-t border-white/10 flex items-center gap-3 bg-[#0A4C5E]/90">
        <img
          src={user.profile_image || "https://via.placeholder.com/50"}
          className="w-11 h-11 rounded-full border-2 border-white/80 shadow-lg"
        />
        <div>
          <p className="font-semibold">{user.name || "Loading..."}</p>
          <p className="text-sm text-teal-100">{user.role || "Recruiter"}</p>
        </div>
      </div>
    </aside>
  );
};
 
/* ================= Sidebar Button ================= */
const SidebarItem = ({ icon, label, link, active }) => {
  const navigate = useNavigate();
  const isActive = active === label;
 
  return (
    <button
      onClick={() => navigate(link)}
      className={`
        flex items-center gap-4 px-4 py-3 w-full text-lg rounded-xl font-medium
        transition-all duration-200
 
        ${isActive
          ? "bg-white text-[#073C4D] shadow-md"
          : "text-white hover:bg-white/20"}
      `}
    >
      {React.cloneElement(icon, { size: 20 })}
      {label}
    </button>
  );
};
 
export default RecruiterSidebar;
 
 
 