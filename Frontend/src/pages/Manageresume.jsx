import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Trash2,
  Eye,
  Download,
  Settings,
  Grid,
  User,
  Plus,
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useNavigate } from "react-router-dom";

const Manageresume = () => {
  const [resumes, setResumes] = useState([]);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  // -------------------------------------------------
  // Fetch all resumes
  // -------------------------------------------------
  const fetchResumes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/resumes/`);
      const data = await res.json();

      const list =
        data.results ??
        data.data ??
        data.items ??
        (Array.isArray(data) ? data : []);

      setResumes(list);
    } catch (err) {
      console.error("Error fetching resumes:", err);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  // -------------------------------------------------
  // Upload Resume
  // -------------------------------------------------
  const handleUpload = () => fileRef.current?.click();

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;

    try {
      const formData = new FormData();
      for (let f of files) {
        formData.append("file", f);
      }

      await fetch(`${API_BASE_URL}/upload-resume/`, {
        method: "POST",
        body: formData,
      });

      fetchResumes();
    } catch (err) {
      console.error("Upload failed:", err);
    }

    e.target.value = null;
  };

  // -------------------------------------------------
  // Delete Resume
  // -------------------------------------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this resume?")) return;

    try {
      await fetch(`${API_BASE_URL}/resumes/delete/${id}/`, {
        method: "DELETE",
      });

      fetchResumes();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // -------------------------------------------------
  // Full View using /viewresume
  // -------------------------------------------------
  const openFullView = (resume) => {
    let fileName =
      resume.file_name ||
      resume.readable_file_name ||
      resume.s3_url?.split("/").pop();

    if (!fileName) {
      alert("Cannot open: Missing file name");
      return;
    }

    navigate(`/viewresume?file_name=${encodeURIComponent(fileName)}`);
  };

  return (
    <div className="min-h-screen flex bg-[#E9F1F4]">
      {/* Sidebar */}
      <aside className="w-80 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-xl font-semibold">Manager Panel</h2>
        </div>

        <div className="flex-1 p-4 space-y-2">
          <div className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
            <Grid size={18} /> Dashboard
          </div>

          <div className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
            Retrieve
          </div>

          <div className="p-3 bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
            Manage Resume
          </div>

          <div className="p-3 hover:bg-white/10 rounded-lg flex items-center gap-3 cursor-pointer">
            <Settings size={18} /> Settings
          </div>
        </div>

        <div className="p-5 border-t border-white/20 flex gap-3 items-center">
          <img
            src="https://randomuser.me/api/portraits/men/65.jpg"
            className="w-10 h-10 rounded-full border"
            alt="profile"
          />
          <div>
            <p className="font-semibold">Alex Green</p>
            <p className="text-sm text-teal-100">Engineering Manager</p>
          </div>
          <User size={18} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-[#0D1F29]">Manage Resumes</h1>
            <p className="text-gray-600">View, upload, and manage resumes.</p>
          </div>

          <button
            onClick={handleUpload}
            className="px-5 py-2 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] text-white rounded-full flex items-center gap-2 shadow"
          >
            <Plus size={16} /> Upload Resume
          </button>

          <input
            type="file"
            ref={fileRef}
            multiple
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Resume Cards */}
        {resumes.length === 0 ? (
          <p className="text-center text-gray-500 mt-20">No resumes found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resumes.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-6 shadow hover:shadow-xl transition"
              >
                <div className="flex gap-3 mb-3">
                  <FileText size={28} className="text-[#0F394D]" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {r.candidate_name || r.name}
                    </h3>
                    <p className="text-sm text-gray-600">{r.email}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  <b>Experience:</b> {r.experience_years} yrs
                </p>
                <p className="text-sm text-gray-700">
                  <b>CPD Level:</b> {r.cpd_level}
                </p>
                <p className="text-sm text-gray-700">
                  <b>File:</b> {r.file_name}
                </p>

                <div className="flex justify-between mt-5">
                  <button
                    onClick={() => openFullView(r)}
                    className="px-3 py-2 border rounded-md flex items-center gap-2 text-sm"
                  >
                    <Eye size={16} /> Full View
                  </button>

                  <a
                    href={r.s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 border rounded-md flex items-center gap-2 text-sm"
                  >
                    <Download size={16} /> Download
                  </a>
                </div>

                <button
                  onClick={() => handleDelete(r.id)}
                  className="mt-4 w-full py-2 border border-red-500 text-red-600 rounded-md flex items-center justify-center gap-2 text-sm"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Manageresume;
