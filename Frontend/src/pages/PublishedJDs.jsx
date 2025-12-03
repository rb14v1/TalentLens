// src/pages/PublishedJDs.jsx

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
  Download,
  Edit,
} from "lucide-react";

import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";   // ⭐ ADDED
import { API_BASE_URL } from "../config";

const PublishedJDs = () => {
  const navigate = useNavigate();

  const [myJobs, setMyJobs] = useState([]);
  const [deptJobs, setDeptJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [collapsed, setCollapsed] = useState(true); // ⭐ Adaptive sidebar

  const [deleteModal, setDeleteModal] = useState({ show: false, id: null });

  const safeMatch = (val1, val2) => {
    if (!val1 || !val2) return false;
    try {
      return val1.toString().toLowerCase().trim() === val2.toString().toLowerCase().trim();
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userRes = await fetch(`${API_BASE_URL}/user/profile/`, { credentials: "include" });
        if (!userRes.ok) throw new Error("Could not fetch user profile");
        const userData = await userRes.json();

        const userEmail = userData.email || "";
        const userName = userData.name || "";

        const jobsRes = await fetch(`${API_BASE_URL}/jobs/list/`, { credentials: "include" });
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

  // Status Modal
  const [statusModal, setStatusModal] = useState({ show: false, job: null });

  const handleToggleStatus = (job) => {
    setStatusModal({ show: true, job });
  };

  const confirmStatusChange = async () => {
    const job = statusModal.job;
    if (!job) return;

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

      setStatusModal({ show: false, job: null });
    } catch (e) {
      alert(`Could not update status: ${e.message}`);
    }
  };

  const handleViewJD = (job) => {
    if (!job.id) return alert("Invalid Job ID");

    const safeTitle = (job.title || "Job")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "");

    const frontendUrl = `/view-job/${job.id}/${safeTitle}`;
    window.open(frontendUrl, "_blank");
  };

  const handleDownload = async (job) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/download/${job.id}/`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", job.file_name || "job.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert("Download failed.");
      console.error(e);
    }
  };

  const handleEdit = (job) => {
    navigate("/description", { state: { jobData: job, isEdit: true } });
  };

  const JobCard = ({ job, isMine }) => {
    if (!job) return null;
    const isActive = job.status === "Open" || job.status === "Active";

    return (
      <div
        className={`bg-white rounded-2xl p-5 shadow-sm border transition relative mb-6
        ${isActive ? "border-gray-100" : "border-gray-200 bg-gray-50/50"}
        hover:shadow-md`}
      >
        {/* HEADER */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-4">
            <h3
              className={`text-lg font-bold leading-tight ${
                isActive ? "text-[#0F394D]" : "text-gray-500"
              }`}
            >
              {job.title || "Untitled"}
            </h3>
            <p className="text-gray-500 font-medium text-xs mt-1">
              {job.department || "General"}
            </p>

            {!isMine && (
              <div className="text-[10px] text-gray-400 mt-1">
                By: {job.creator_name || "Unknown"}
              </div>
            )}
          </div>

          <button
            onClick={() => handleToggleStatus(job)}
            className={`
              text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full flex items-center gap-1 transition shadow-sm cursor-pointer hover:opacity-80
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

        {/* DETAILS */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <span className="bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 flex gap-1 items-center text-[11px] font-medium">
            <MapPin size={12} className="text-gray-400" />{" "}
            {job.location || "Remote"}
          </span>
          <span className="bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 flex gap-1 items-center text-[11px] font-medium">
            <Briefcase size={12} className="text-gray-400" />{" "}
            {job.type || "Full-time"}
          </span>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
          <button
            onClick={() => handleViewJD(job)}
            className="flex-1 bg-[#21B0BE] text-white px-3 py-1.5 rounded-lg flex justify-center items-center gap-1.5 hover:bg-[#198d99] transition font-medium text-xs shadow-sm"
          >
            <Eye size={14} /> View
          </button>

          {isMine && (
            <button
              onClick={() => handleEdit(job)}
              className="flex-1 bg-[#21B0BE] text-white px-3 py-1.5 rounded-lg flex justify-center items-center gap-1.5 hover:bg-[#198d99] transition font-medium text-xs shadow-sm"
            >
              <Edit size={14} /> Edit
            </button>
          )}

          <button
            onClick={() => handleDownload(job)}
            className="flex-1 bg-white border border-[#21B0BE] text-[#21B0BE] px-3 py-1.5 rounded-lg flex justify-center items-center gap-1.5 hover:bg-blue-50 transition font-medium text-xs shadow-sm"
          >
            <Download size={14} /> Download
          </button>

          <button
            onClick={() => handleDeleteClick(job.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition border border-transparent hover:border-red-100"
            title="Delete Job"
          >
            <Trash2 size={16} />
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
    <div className="min-h-screen flex flex-col bg-[#E9F1F4]">
      {/* ⭐ GLOBAL HEADER */}
      <GlobalHeader />

      <div className="flex flex-1 pt-[72px]">
        {/* ⭐ SIDEBAR -- adaptive, below header */}
        <HiringManagerSidebar setCollapsed={setCollapsed} />

        {/* ⭐ MAIN CONTENT */}
        <main
          className="flex-1 py-10 pr-10 pl-10 transition-all duration-300"
          style={{
            marginLeft: collapsed ? "5rem" : "18rem",
          }}
        >
          {/* <button
            onClick={() => navigate(-1)}
            className="absolute top-28 right-10 bg-white text-[#0F394D] px-5 py-2 rounded-full shadow hover:bg-gray-50"
          >
            Back
          </button> */}

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
                  myJobs.map((job) => <JobCard key={job.id} job={job} isMine={true} />)
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
                  deptJobs.map((job) => <JobCard key={job.id} job={job} isMine={false} />)
                ) : (
                  <p className="text-gray-400 italic mt-4 p-4 border border-dashed rounded-lg bg-white">
                    No other jobs in this department.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-50 p-4 rounded-full mb-4">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#0F394D] mb-2">
                Delete Job Description?
              </h3>
              <p className="text-gray-500 mb-6 px-4">
                Are you sure you want to delete this job? This action cannot be undone.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteModal({ show: false, id: null })}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-lg"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CHANGE MODAL */}
      {statusModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex flex-col items-center text-center">
              <div className="bg-[#E0F7FA] p-4 rounded-full mb-4">
                <AlertTriangle className="text-[#21B0BE]" size={32} />
              </div>

              <h3 className="text-2xl font-bold text-[#0F394D] mb-2">
                Change Status?
              </h3>

              <p className="text-gray-500 mb-6 px-4 text-sm">
                Are you sure you want to change the status of <br />
                <span className="font-bold text-[#0F394D]">
                  {statusModal.job?.title}
                </span>
                ?
                <br /> <br />
                This will switch it from{" "}
                <span className="font-bold">{statusModal.job?.status}</span> to{" "}
                <span className="font-bold">
                  {statusModal.job?.status === "Open" ? "Closed" : "Open"}
                </span>
                .
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setStatusModal({ show: false, job: null })}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmStatusChange}
                  className="flex-1 py-3 rounded-xl bg-[#0F394D] text-white font-semibold hover:bg-[#092532] shadow-lg"
                >
                  Yes, Change
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
