import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
 
const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [jds, setJds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
 
  useEffect(() => {
    const published = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    setJds(published);
  }, []);
 
  const filteredJDs = useMemo(() => {
    return jds.filter((jd) =>
      jd.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [jds, searchQuery]);
 
  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">
 
      {/* SIDEBAR */}
      <div className="w-72">
        <HiringManagerSidebar jds={jds} />
      </div>
 
      {/* MAIN CONTENT */}
      <div className="flex-1 p-10">
 
        {/* HEADER — FIXED & CLEAN */}
        <div className="flex items-center justify-between mb-10">
 
          {/* Center Title */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-3xl font-bold text-[#0F394D]">
              JD Dashboard
            </h1>
          </div>
 
          {/* Back Button */}
          <button
            onClick={() => navigate("/managerpage")}
            className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
                       text-white px-6 py-2 rounded-full shadow hover:opacity-90 transition-all"
          >
            Back
          </button>
        </div>
 
        {/* SEARCH BAR */}
        <div className="flex items-center bg-white border rounded-lg shadow-sm px-4 py-3 mb-10 w-full">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search JDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ml-3 w-2/3 outline-none text-gray-700 text-base"
          />
        </div>
 
        {/* MAIN TWO CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
 
          {/* MY JDs SECTION */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border">
 
            {/* HEADER + CREATE BUTTON */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-semibold text-[#0F394D]">
                My JDs
              </h2>
 
              <button
                onClick={() => navigate("/description")}
                className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE]
                           text-white px-4 py-2 rounded-full text-sm shadow hover:opacity-90 transition"
              >
                + Create JD
              </button>
            </div>
 
            {/* CARDS */}
            {filteredJDs.length > 0 ? (
              filteredJDs.map((jd) => (
                <div
                  key={jd.id}
                  className="bg-white rounded-2xl shadow border p-5 mb-6 hover:shadow-xl transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-[#0D1F29]">
                      {jd.jobTitle}
                    </h3>
                    <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>
 
                  <p className="text-gray-600 text-sm">
                    Experience: {jd.experience || "N/A"}
                  </p>
 
                  <p className="text-gray-700 text-sm mt-2 line-clamp-2">
                    {jd.summary || "No description available"}
                  </p>
 
                  <div className="flex gap-6 mt-4 text-sm font-medium">
                    <button className="text-[#21B0BE] hover:text-[#0F394D]">View Details</button>
                    <button className="text-[#21B0BE] hover:text-[#0F394D]">Download</button>
                    <button className="text-red-500 hover:text-red-700">Delete</button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm italic">No JDs found.</p>
            )}
          </div>
 
          {/* OTHER JDs SECTION */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border">
            <h2 className="text-2xl font-semibold text-[#0F394D] mb-5">All / Other JDs</h2>
 
            {filteredJDs.length > 0 ? (
              filteredJDs.map((jd) => (
                <div
                  key={jd.id}
                  className="bg-white rounded-2xl shadow border p-5 mb-6 hover:shadow-xl transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-[#0D1F29]">
                      {jd.jobTitle}
                    </h3>
                    <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>
 
                  <p className="text-gray-600 text-sm">Experience: N/A</p>
                  <p className="text-gray-700 text-sm mt-2 line-clamp-2">
                    No description available
                  </p>
 
                  <div className="flex gap-6 mt-4 text-sm font-medium">
                    <button className="text-[#21B0BE] hover:text-[#0F394D]">View Details</button>
                    <button className="text-[#21B0BE] hover:text-[#0F394D]">Download</button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm italic">No JDs available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default ManagerDashboard;
 
 
 