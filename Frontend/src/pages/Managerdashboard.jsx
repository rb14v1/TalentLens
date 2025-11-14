import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Briefcase,
  Grid,
  Layers,
  Building,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const Managerdashboard = () => {
  const currentUser = {
    name: "Alex Green",
    role: "Engineering Manager",
    department: "Engineering / IT",
    sector: "AI",
  };

  // ✅ Load published JDs dynamically from Preview.jsx
  const [jds, setJds] = useState([]);
  useEffect(() => {
    const published = JSON.parse(localStorage.getItem("publishedJDs") || "[]");
    setJds(published);
  }, []);

  // ✅ Sidebar departments (same as before)
  const departments = [
    {
      name: "Human Resources",
      roles: [
        "Junior HR",
        "Senior HR",
        "HR Operations",
        "Talent Acquisition",
        "Learning & Development",
      ],
    },
    {
      name: "Engineering / IT",
      roles: [
        "Software Development",
        "DevOps",
        "Data Science",
        "Machine Learning",
        "Quality Assurance",
        "Cybersecurity",
      ],
    },
    {
      name: "Sales & Marketing",
      roles: [
        "Pre-Sales",
        "Post-Sales",
        "Business Development",
        "Digital Marketing",
        "Product Marketing",
      ],
    },
    {
      name: "Finance & Accounting",
      roles: ["Accounting", "Auditing", "Taxation", "Financial Analysis"],
    },
    {
      name: "Operations & Management",
      roles: [
        "Project Management",
        "Supply Chain Management",
        "Procurement",
        "Customer Success",
      ],
    },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [openAllJDs, setOpenAllJDs] = useState(false);

  const filteredJDs = useMemo(() => {
    return jds.filter((jd) =>
      jd.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, jds]);

  const groupedByDepartment = useMemo(() => {
    const groups = {};
    filteredJDs.forEach((jd) => {
      const dept = jd.department || "Other";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(jd);
    });
    return groups;
  }, [filteredJDs]);

  return (
    <div className="min-h-screen flex bg-[#F5F5F5]">
      {/* ================= Sidebar ================= */}
      <aside className="w-80 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-[#1CA9A3]/30">
          <h2 className="text-2xl font-semibold tracking-wide">JD Dashboard</h2>
          <p className="text-sm text-teal-100 mt-1">
            Manage and review job descriptions
          </p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-xs uppercase text-teal-200 font-semibold mb-3">
            View Options
          </h3>
          <ul className="space-y-2 mb-6">
            <li className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[#21B0BE]/40 transition-all">
              <Grid size={18} /> <span>My Department</span>
            </li>
            <li className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-[#21B0BE]/40 transition-all">
              <Layers size={18} /> <span>My Sector</span>
            </li>
          </ul>

          <h3 className="text-xs uppercase text-teal-200 font-semibold mb-3">
            Departments
          </h3>
          <div className="space-y-4">
            {/* All JDs */}
            <div
              className="bg-[#ffffff]/10 hover:bg-[#ffffff]/20 rounded-lg p-3 transition-all cursor-pointer"
              onClick={() => setOpenAllJDs(!openAllJDs)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Briefcase size={16} />
                  <span className="text-sm font-semibold">All JDs</span>
                </div>
                {openAllJDs ? (
                  <ChevronDown size={14} className="text-teal-100" />
                ) : (
                  <ChevronRight size={14} className="text-teal-100" />
                )}
              </div>

              {openAllJDs && (
                <ul className="ml-7 mt-2 text-teal-100 text-xs space-y-1">
                  {filteredJDs.map((jd) => (
                    <li
                      key={jd.id}
                      className="hover:text-white cursor-pointer transition-colors"
                    >
                      • {jd.jobTitle}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Department List */}
            {departments.map((dept) => (
              <div
                key={dept.name}
                className="bg-[#ffffff]/10 hover:bg-[#ffffff]/20 rounded-lg p-3 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Building size={16} />
                    <span className="text-sm font-semibold">{dept.name}</span>
                  </div>
                  <ChevronRight size={14} className="text-teal-100" />
                </div>
                <ul className="ml-7 text-teal-100 text-xs space-y-1">
                  {dept.roles.map((role) => (
                    <li
                      key={role}
                      className="hover:text-white cursor-pointer transition-colors"
                    >
                      • {role}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-5 border-t border-[#1CA9A3]/30 flex items-center gap-3">
          <img
            src="https://randomuser.me/api/portraits/men/65.jpg"
            alt="User"
            className="w-10 h-10 rounded-full border-2 border-white/70"
          />
          <div>
            <p className="font-semibold">{currentUser.name}</p>
            <p className="text-sm text-teal-100">{currentUser.role}</p>
          </div>
        </div>
      </aside>

      {/* ================= Main Dashboard ================= */}
      <main className="flex-1 p-10 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#0D1F29]">Overview</h1>
          <button
            onClick={() => alert("Create new JD feature coming soon!")}
            className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white px-6 py-3 rounded-lg shadow hover:opacity-90 transition-all text-lg"
          >
            + Create New JD
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center bg-white border rounded-lg shadow-sm px-5 py-4 mb-10 w-full max-w-3xl">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by JD title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full outline-none ml-3 text-gray-700 text-lg"
          />
        </div>

        {/* Published JDs by Department */}
        {Object.keys(groupedByDepartment).length > 0 ? (
          Object.entries(groupedByDepartment).map(([dept, deptJDs]) => (
            <section key={dept} className="mb-12">
              <h2 className="text-2xl font-semibold text-[#0D1F29] mb-6 border-b pb-2">
                {dept}
              </h2>
              <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-12 justify-center">
                {deptJDs.map((jd) => (
                  <div
                    key={jd.id}
                    className="bg-white rounded-3xl shadow-lg border hover:shadow-2xl hover:scale-[1.02] px-12 py-8 relative transition-all duration-300 w-full max-w-[620px] mx-auto"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl font-semibold text-[#0D1F29]">
                        {jd.jobTitle}
                      </h3>
                      <span className="text-sm font-medium px-4 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">
                        {jd.status || "Active"}
                      </span>
                    </div>

                    <p className="text-lg text-gray-600 mb-3">
                      Department: {jd.department}
                    </p>
                    <p className="text-lg text-gray-600 mb-3">
                      Experience: {jd.experience}
                    </p>
                    <p className="text-lg text-gray-700 mb-8 leading-relaxed line-clamp-4">
                      {jd.summary || "No description available."}
                    </p>

                    <div className="flex justify-between items-center pt-3 border-t">
                      <button className="text-lg text-[#21B0BE] hover:text-[#0F394D] transition-colors">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="text-gray-600 text-lg">No JDs published yet.</p>
        )}
      </main>
    </div>
  );
};

export default Managerdashboard;
