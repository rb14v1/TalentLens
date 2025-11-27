import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  Eye,
  MapPin,
  Briefcase,
  Loader,
  AlertTriangle,
  CheckCircle, 
  XCircle,
  Clock
} from "lucide-react";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
import { API_BASE_URL } from "../config";

// ✅ ROBUST DATE FORMATTER (Debug Version)
const formatDate = (dateString) => {
  if (!dateString) return "N/A"; 
  if (dateString === "No Date") return "No Date (DB)";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; 
    
    return new Intl.DateTimeFormat("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

const PublishedJDs = () => {
  const navigate = useNavigate();

  const [myJobs, setMyJobs] = useState([]);
  const [deptJobs, setDeptJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleteModal, setDeleteModal] = useState({ show: false, id: null });

  const safeMatch = (val1, val2) => {
    if (!val1 || !val2) return false;
    try {
      return (
        val1.toString().toLowerCase().trim() ===
        val2.toString().toLowerCase().trim()
      );
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userRes = await fetch(`${API_BASE_URL}/user/profile/`, {
          credentials: "include",
        });
        if (!userRes.ok) throw new Error("Could not fetch user profile");
        const userData = await userRes.json();

        const userEmail = userData.email || "";
        const userName = userData.name || "";

        const jobsRes = await fetch(`${API_BASE_URL}/jobs/list/`, {
          credentials: "include",
        });
        if (!jobsRes.ok) throw new Error("Could not fetch jobs list");
        const jobsJson = await jobsRes.json();

        const allJobs = Array.isArray(jobsJson.results)
          ? jobsJson.results
          : Array.isArray(jobsJson)
          ? jobsJson
          : [];

        const mine = [];
        const others = [];

        allJobs.forEach((job) => {
          if (!job) return;

          const jobEmail = job.email || job.creator_email;
          const isEmailMatch = safeMatch(jobEmail, userEmail);
          const jobName = job.creator_name || job.hiringManagerName;
          const isNameMatch = safeMatch(jobName, userName);

          if (isEmailMatch || isNameMatch) {
            mine.push(job);
          } else {
            others.push(job);
          }
        });

        setMyJobs(mine);
        setDeptJobs(others);
      } catch (err) {
        console.error("Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDeleteClick = (id) => {
    setDeleteModal({ show: true, id });
  };

  const confirmDelete = async () => {
    const id = deleteModal.id;
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/delete/${id}/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Delete failed on server");

      setMyJobs((prev) => prev.filter((j) => j.id !== id));
      setDeptJobs((prev) => prev.filter((j) => j.id !== id));
      setDeleteModal({ show: false, id: null });
    } catch (e) {
      alert("Failed to delete job.");
    }
  };

  const handleToggleStatus = async (job) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/status/${job.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) throw new Error(`Server Error: ${res.status}`);

      const data = await res.json();
      const newStatus = data.status;

      setMyJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
      );
      setDeptJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j))
      );
    } catch (e) {
      alert(`Could not update status: ${e.message}`);
    }
  };

  // ✅ Only change: use React Router navigation to view document
  const handleViewJD = (job) => {
  const fileName = job.file_name;
  if (!fileName) {
    alert("No PDF file found.");
    return;
  }
  window.open(
    `${API_BASE_URL}/jd/pdf/?file_name=${encodeURIComponent(fileName)}`,
    "_blank"
  );
};


  const JobCard = ({ job, isMine }) => {
    if (!job) return null;
    const isActive = job.status === "Open";

    const displayDate = formatDate(job.created_at);

    return (
      <div
        className={`bg-white rounded-2xl p-6 shadow-sm border transition relative mb-6 
          ${isActive ? "border-gray-100" : "border-gray-200 bg-gray-50/50"} 
          hover:shadow-md`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h3
                className={`text-xl font-bold ${
                  isActive ? "text-[#0F394D]" : "text-gray-500"
                }`}
              >
                {job.title || "Untitled"}
              </h3>

              <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded flex items-center gap-1">
                <Clock size={10} />
                {displayDate}
              </span>

              <button
                onClick={() => handleToggleStatus(job)}
                className={`
                  text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:opacity-80
                  ${
                    isActive
                      ? "bg-green-100 text-green-700 border border-green-200"
                      : "bg-red-100 text-red-600 border border-red-200"
                  }
                `}
                title="Click to toggle status"
              >
                {isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                {isActive ? "Active" : "Closed"}
              </button>
            </div>

            <p className="text-gray-500 font-medium text-sm">
              {job.department || "General"}
            </p>

            {!isMine && (
              <div className="text-xs text-gray-400 mt-1">
                By: {job.creator_name || "Unknown"}
              </div>
            )}
          </div>

          <button
            onClick={() => handleDeleteClick(job.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition ml-2"
            title="Delete Job"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600 mb-5 mt-3">
          <span className="bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100 flex gap-1.5 items-center text-xs font-medium">
            <MapPin size={14} className="text-gray-400" />{" "}
            {job.location || "Remote"}
          </span>
          <span className="bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100 flex gap-1.5 items-center text-xs font-medium">
            <Briefcase size={14} className="text-gray-400" />{" "}
            {job.type || "Full-time"}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => handleViewJD(job)}
            className="w-full bg-[#21B0BE] text-white px-4 py-2 rounded-lg flex justify-center items-center gap-2 hover:bg-[#198d99] transition font-medium shadow-sm text-sm"
          >
            <Eye size={16} /> View JD Document
          </button>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-10 text-center text-red-600">
        <AlertTriangle size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 bg-gray-800 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#E9F1F4]">
      <div className="w-64 flex-shrink-0">
        <HiringManagerSidebar />
      </div>
      <main className="flex-1 py-10 pr-10 pl-20 relative overflow-y-auto">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-8 right-8 bg-white text-[#0F394D] px-5 py-2 rounded-full shadow hover:bg-gray-50"
        >
          Back
        </button>

        <h1 className="text-3xl font-bold text-[#0D1F29] mb-8">
          Published Job Descriptions
        </h1>

        {loading ? (
          <div className="flex justify-center h-64">
            <Loader className="animate-spin text-[#21B0BE]" size={40} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xl font-bold text-[#0F394D] mb-4 border-b-2 border-[#21B0BE] pb-2 flex justify-between">
                My Job Postings{" "}
                <span className="bg-[#21B0BE]/10 text-[#0F394D] text-xs px-2 py-1 rounded-full">
                  {myJobs.length}
                </span>
              </h2>
              {myJobs.length > 0 ? (
                myJobs.map((job) => (
                  <JobCard key={job.id} job={job} isMine={true} />
                ))
              ) : (
                <p className="text-gray-400 italic mt-4 p-4 border border-dashed rounded-lg bg-white">
                  No jobs found for you.
                </p>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F394D] mb-4 border-b-2 border-gray-300 pb-2 flex justify-between">
                Department Postings{" "}
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                  {deptJobs.length}
                </span>
              </h2>
              {deptJobs.length > 0 ? (
                deptJobs.map((job) => (
                  <JobCard key={job.id} job={job} isMine={false} />
                ))
              ) : (
                <p className="text-gray-400 italic mt-4 p-4 border border-dashed rounded-lg bg-white">
                  No other jobs in this department.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#0F394D] mb-2">
                Delete Job Description?
              </h3>
              <p className="text-gray-500 mb-6 px-4">
                Are you sure you want to delete this job? This action cannot be
                undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteModal({ show: false, id: null })}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-lg shadow-red-200 transition"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishedJDs;
