import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Grid,
  FileText,
  Briefcase,
  LogOut,
} from "lucide-react";
import { API_BASE_URL } from "../config";

const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);        // ⬅ MULTIPLE FILES
  const [uploading, setUploading] = useState(false);
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState(false);

  const handleDepartmentChange = (e) => {
    setDepartment(e.target.value);
    if (e.target.value) setSelected(true);
  };

  // MULTIPLE file selection
  const handleFileChange = (e) => {
    const fileList = Array.from(e.target.files);
    setFiles(fileList);
  };

  // =====================================================
  // 🔥 MULTI-FILE UPLOAD BACKEND INTEGRATION
  // =====================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.length) {
      alert("Please select at least one file before submitting.");
      return;
    }

    setUploading(true);

    try {
      // Upload files one by one
      for (const file of files) {
        const formData = new FormData();
        formData.append("resume_file", file);
        formData.append("department", department);

        const response = await fetch(`${API_BASE_URL}/upload/`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          alert(`Error uploading ${file.name}: ${data.error}`);
          continue;
        }
      }

      alert(`Uploaded ${files.length} file(s) successfully to ${department}!`);
      setFiles([]);
      setUploading(false);

    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Check server connection.");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#E9F1F4] text-gray-800">
      {/* Sidebar */}
      <aside className="w-72 bg-gradient-to-b from-[#0F394D] to-[#21B0BE] text-white flex flex-col justify-between shadow-lg">
        <div>
          <div className="p-6 border-b border-[#1CA9A3]/30">
            <h1 className="text-2xl font-bold text-center tracking-wide">
              Recruiter Panel
            </h1>
          </div>

          <nav className="flex flex-col p-5 space-y-3 mt-4">
            <button
              onClick={() => navigate("/upload")}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <UploadCloud size={18} /> <span>Upload</span>
            </button>

            <button
              onClick={() => navigate("/retrieve")}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/20 transition"
            >
              <FileText size={18} /> <span>Retrieve</span>
            </button>

            <button
              onClick={() => navigate("/recruiterdashboard")}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/20 transition"
            >
              <Grid size={18} /> <span>Dashboard</span>
            </button>

            <button
              onClick={() => navigate("/manageresume")}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/20 transition"
            >
              <Briefcase size={18} /> <span>Manage Resume</span>
            </button>
          </nav>
        </div>

        {/* Profile */}
        <div className="border-t border-[#1CA9A3]/30 p-5 bg-gradient-to-b from-[#0F394D]/90 to-[#21B0BE]/90 flex items-center gap-3">
          <img
            src="https://randomuser.me/api/portraits/women/45.jpg"
            alt="Profile"
            className="w-10 h-10 rounded-full border-2 border-white/70"
          />
          <div className="flex-1">
            <p className="font-semibold">Bhoomika</p>
            <p className="text-sm text-teal-100">Recruiter</p>
          </div>
          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Upload Section */}
      <main className="flex-1 flex justify-center items-center bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4] p-8 relative">
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-8 right-8 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] 
                     text-white px-5 py-2 rounded-full shadow hover:opacity-90 transition flex items-center gap-2 z-20"
        >
          Back
        </button>

        <div className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-[#CFE5EA] p-10">
          <div className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl bg-gradient-to-r from-[#0F394D] to-[#21B0BE]" />

          {!selected ? (
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-[#0F394D] mb-8 text-center">
                Select Department
              </h2>

              <div className="flex flex-col space-y-5 items-center">
                <select
                  value={department}
                  onChange={handleDepartmentChange}
                  className="w-full border border-[#CFE5EA] rounded-lg py-3 px-4 focus:ring-2 focus:ring-[#21B0BE] bg-[#F8FAFC]"
                >
                  <option value="">-- Choose Department --</option>
                  <option value="Engineering">Engineering</option>
                  <option value="HR">Human Resources</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Finance">Finance</option>
                  <option value="Operations">Operations</option>
                </select>

                <button
                  disabled={!department}
                  onClick={() => setSelected(true)}
                  className={`w-full py-3 rounded-lg text-white font-medium text-sm shadow-md transition duration-300 ${
                    !department
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90"
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col items-center space-y-5"
            >
              <h2 className="text-2xl font-bold text-[#0F394D] mb-8 text-center mt-4">
                Upload File ({department})
              </h2>

              <div className="w-full border-2 border-dashed border-[#21B0BE]/40 rounded-xl py-12 flex flex-col justify-center items-center bg-[#F8FAFC] hover:border-[#21B0BE] transition">
                <UploadCloud className="w-12 h-12 text-[#21B0BE] mb-3" />
                <p className="text-gray-600 text-sm mb-2">
                  Drag & Drop your files here
                </p>
                <p className="text-gray-400 text-xs mb-3">or</p>

                <label className="cursor-pointer">
                  <span className="bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90 text-white font-medium px-6 py-2 rounded-full text-sm transition">
                    Browse
                  </span>
                  <input
                    type="file"
                    multiple               // ⬅ ENABLE MULTIPLE
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {files.length > 0 && (
                <div className="text-[#0F394D] text-sm bg-[#E9F1F4] px-3 py-2 rounded-lg w-full text-center space-y-1">
                  <strong>Selected Files:</strong>
                  {files.map((f, i) => (
                    <p key={i}>{f.name}</p>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className={`w-full py-3 rounded-lg text-white font-medium shadow-md transition duration-300 ${
                  uploading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90"
                }`}
              >
                {uploading ? "Uploading..." : "Submit"}
              </button>

              <button
                type="button"
                onClick={() => setSelected(false)}
                className="text-[#21B0BE] text-sm mt-3 hover:underline"
              >
                ← Back to Department Selection
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default Upload;
