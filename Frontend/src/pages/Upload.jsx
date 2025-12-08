// src/pages/Upload.jsx
import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle, XCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import GlobalHeader from "../components/sidebar/GlobalHeader";
import { API_BASE_URL } from "../config";
 
// ---------------- SHA-256 HELPER ----------------
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
 
const Upload = () => {
  const navigate = useNavigate();
 
  const [collapsed, setCollapsed] = useState(true);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
 
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
 
  const [salary, setSalary] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("EUR");
  const [candidateType, setCandidateType] = useState("external");
 
  // ---------------- DRAG & DROP (Final Production-Grade) ----------------
  const dropRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
 
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
 
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
 
    // Close highlight ONLY if leaving the container entirely
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };
 
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy"; // REQUIRED for Chrome/Safari
  };
 
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
 
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
  };
 
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };
 
  // ---------------- MAIN UPLOAD FUNCTION ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
 
    if (!files.length) {
      setModalState({
        isOpen: true,
        title: "No Files Selected",
        message: "Please select at least one file.",
        type: "info",
      });
      return;
    }
 
    setUploading(true);
    setUploadStatus("Starting…");
 
    const successFiles = [];
    const duplicateFiles = [];
    const errorFiles = [];
 
    try {
      for (const file of files) {
        setUploadStatus(`Checking ${file.name}…`);
 
        const hash = await calculateFileHash(file);
 
        const checkRes = await fetch(`${API_BASE_URL}/check-hashes/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hashes: [hash] }),
        });
 
        const checkData = await checkRes.json();
 
        if (checkData.existing_hashes?.length > 0) {
          duplicateFiles.push(file.name);
          continue;
        }
 
        setUploadStatus(`Uploading ${file.name}…`);
 
        const formData = new FormData();
        formData.append("resume_file", file);
        formData.append("file_hash", hash);
 
        if (salary) formData.append("salary", salary);
        if (salaryCurrency)
          formData.append("salary_currency", salaryCurrency);
        if (candidateType) formData.append("candidate_type", candidateType);
 
        const uploadRes = await fetch(`${API_BASE_URL}/upload-resume/`, {
          method: "POST",
          body: formData,
        });
 
        const data = await uploadRes.json();
 
        if (!uploadRes.ok) {
          errorFiles.push(`${file.name}: ${data.error || "Upload failed"}`);
        } else {
          successFiles.push(file.name);
        }
      }
 
      let modal = { isOpen: true, type: "success", message: "" };
 
      if (successFiles.length)
        modal.message += `Uploaded:\n- ${successFiles.join("\n- ")}\n\n`;
 
      if (duplicateFiles.length) {
        modal.message += `Skipped duplicates:\n- ${duplicateFiles.join("\n- ")}\n\n`;
        modal.type = "info";
      }
 
      if (errorFiles.length) {
        modal.message += `Failed:\n- ${errorFiles.join("\n- ")}`;
        modal.type = "error";
      }
 
      modal.title =
        successFiles.length > 0 ? "Upload Complete" :
        duplicateFiles.length > 0 ? "Files Already Exist" :
        "Upload Failed";
 
      setModalState(modal);
      setFiles([]);
    } catch (err) {
      setModalState({
        isOpen: true,
        title: "Upload Failed",
        message: err.message,
        type: "error",
      });
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };
 
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
 
      {/* GLOBAL HEADER */}
      <GlobalHeader />
 
      {/* PAGE HEADER */}
      <div className="text-center mt-2 mb-4"> <br></br> <br></br> <br></br>
        <h1 className="text-3xl font-bold text-[#073C4D]">Upload Resume</h1>
        <p className="text-gray-600 text-md italic ">
          Submit and manage your resumes securely for screening and processing
        </p>
      </div>
 
      {/* CONTENT LAYOUT */}
      <div className="flex flex-1 pt-[24px]">
        <RecruiterSidebar active="Upload" setCollapsed={setCollapsed} />
 
        <main
          className="flex-1 p-4 md:p-10 transition-all flex justify-center"
          style={{ marginLeft: collapsed ? "5rem" : "18rem" }}
        >
          {/* CARD */}
          <div
            className="
              max-w-lg w-full bg-white shadow-xl p-6 md:p-10
              rounded-2xl border mx-auto relative
            "
          >
            <form onSubmit={handleSubmit} className="space-y-6">
 
              {/* UPLOAD ZONE */}
              <div
                ref={dropRef}
                className={`
                  relative border-2 border-dashed rounded-xl
                  h-52 md:h-64 flex flex-col items-center justify-center
                  text-center transition
                  ${isDragging ? "border-[#21B0BE] bg-[#E9F9FB]" : "border-[#21B0BE]/40"}
                `}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {/* Drag Overlay */}
                {isDragging && (
                  <div
                    className="
                      absolute inset-0 flex items-center justify-center
                      bg-[#E9F9FB]/70 rounded-xl text-[#0F394D]
                      text-xl font-semibold backdrop-blur-sm
                    "
                  >
                    Drop files to upload
                  </div>
                )}
 
                <UploadCloud className="text-[#21B0BE] w-12 h-12 mb-4 pointer-events-none" />
 
                <p
                  className="text-gray-700 pointer-events-none"
                  style={{ fontFamily: "Times New Roman", fontSize: "15px" }}
                >
                  Upload your resumes here
                </p>
 
                <p className="text-gray-400 text-sm mb-4 pointer-events-none">or</p>
 
                <label className="cursor-pointer z-10">
                  <span className="
                    bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
                    px-6 py-2 rounded-full text-white font-medium shadow-md
                    hover:shadow-lg transition
                  ">
                    Browse
                  </span>
 
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.rtf"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
 
              {/* SALARY + CURRENCY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expected / Current Salary
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Enter amount"
                  />
                </div>
 
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={salaryCurrency}
                    onChange={(e) => setSalaryCurrency(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="INR">INR</option>
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
 
              {/* CANDIDATE TYPE */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Candidate Type
                </label>
                <select
                  value={candidateType}
                  onChange={(e) => setCandidateType(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="internal">Internal</option>
                  <option value="external">External</option>
                </select>
              </div>
 
              {/* STATUS */}
              {uploadStatus && (
                <p className="text-sm text-gray-600">{uploadStatus}</p>
              )}
 
              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={uploading || !files.length}
                className={`
                  w-full py-3 rounded-lg text-white shadow
                  ${
                    uploading || !files.length
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-[#073C4D] to-[#1AB8C0] hover:opacity-90"
                  }
                `}
              >
                {uploading ? "Processing…" : `Upload ${files.length} File(s)`}
              </button>
            </form>
          </div>
        </main>
      </div>
 
      {/* MODAL */}
      <CustomAlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </div>
  );
};
 
// ---------------- MODAL COMPONENT ----------------
const CustomAlertModal = ({ isOpen, title, message, type, onClose }) => {
  if (!isOpen) return null;
 
  const icon = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    info: <Info className="w-12 h-12 text-[#21B0BE]" />,
  }[type];
 
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-center">{icon}</div>
 
        <h3 className="text-xl font-semibold text-center mt-4">{title}</h3>
 
        <p className="text-center text-gray-600 whitespace-pre-line mt-2">
          {message}
        </p>
 
        <button
          onClick={onClose}
          className="
            w-full mt-6 py-2
            bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
            text-white rounded-lg
          "
        >
          OK
        </button>
      </div>
    </div>
  );
};
 
export default Upload;
 
 