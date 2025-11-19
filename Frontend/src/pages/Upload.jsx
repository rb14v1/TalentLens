import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Grid,
  FileText,
  Briefcase,
  LogOut,
  // ✅ ADDED THESE ICONS
  Loader,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { API_BASE_URL } from "../config";

/**
 * Calculates the SHA-256 hash of a file.
 * @param {File} file The file to hash
 * @returns {Promise<string>} The hex-encoded SHA-256 hash
 */
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(""); // This is from your original file

  // --- ✅ NEW: State for our custom modal ---
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // 'info', 'success', or 'error'
  });
  // ------------------------------------------

  // MULTIPLE file selection (Your original function)
  const handleFileChange = (e) => {
    const fileList = Array.from(e.target.files);
    setFiles(fileList);
  };

  // =====================================================
  // 🔥 MODIFIED: Replaced all `alert()` calls with `setModalState()`
  // =====================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!files.length) {
      // ❗️ REPLACED alert()
      setModalState({
        isOpen: true,
        title: "No Files Selected",
        message: "Please select at least one file before submitting.",
        type: "info",
      });
      return;
    }

    setUploading(true);
    setUploadStatus("Starting..."); // for the small status text

    const successFiles = [];
    const duplicateFiles = [];
    const errorFiles = [];

    try {
      // Check and upload files one by one
      for (const file of files) {
        setUploadStatus(`Checking ${file.name} for duplicates...`);

        // 1. Calculate file hash
        const hash = await calculateFileHash(file);

        // 2. Check hash with the backend
        const checkResponse = await fetch(`${API_BASE_URL}/check-hashes/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hashes: [hash] }),
        });

        if (!checkResponse.ok) {
          throw new Error(`Server error checking hash for ${file.name}`);
        }

        const checkData = await checkResponse.json();

        // 3. If hash exists, skip file
        if (checkData.existing_hashes && checkData.existing_hashes.length > 0) {
          duplicateFiles.push(file.name);
          continue; // Skip to the next file
        }

        // 4. If new, upload the file
        setUploadStatus(`Uploading ${file.name}...`);
        const formData = new FormData();
        formData.append("resume_file", file);

        const uploadResponse = await fetch(`${API_BASE_URL}/upload-resume/`, {
          method: "POST",
          body: formData,
        });

        const data = await uploadResponse.json();

        if (!uploadResponse.ok) {
          errorFiles.push(`${file.name}: ${data.error || "Unknown error"}`);
          continue; // Skip to the next file
        }

        successFiles.push(file.name);
      }

      // 5. Show final summary message in the modal
      let title = "Upload Complete";
      let message = "";
      let type = "success";

      if (successFiles.length > 0) {
        message += `Successfully uploaded ${
          successFiles.length
        } file(s):\n- ${successFiles.join("\n- ")}\n\n`;
      }
      if (duplicateFiles.length > 0) {
        message += `Skipped ${
          duplicateFiles.length
        } duplicate file(s):\n- ${duplicateFiles.join("\n- ")}\n\n`;
        type = "info"; // If we skipped files, it's more of an "info"
      }
      if (errorFiles.length > 0) {
        message += `Failed to upload ${
          errorFiles.length
        } file(s):\n- ${errorFiles.join("\n- ")}`;
        type = "error"; // If anything failed, it's an "error"
      }

      // Handle case where all files were duplicates
      if (successFiles.length === 0 && duplicateFiles.length > 0 && errorFiles.length === 0) {
        title = "Files Already Exist";
        message = `All ${duplicateFiles.length} selected file(s) were already in the database and were skipped.`;
        type = "info";
      }

      // ❗️ REPLACED alert()
      setModalState({ isOpen: true, title, message, type });
      setFiles([]);

    } catch (err) {
      console.error("Upload failed:", err);
      // ❗️ REPLACED alert()
      setModalState({
        isOpen: true,
        title: "Upload Failed",
        message: `${err.message}. Please check the server connection.`,
        type: "error",
      });
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };

  return (
    <> {/* <-- ✅ WRAPPED in a Fragment */}
      <div className="min-h-screen flex bg-[#E9F1F4] text-gray-800">
        {/* Sidebar (Your original design - UNCHANGED) */}
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

          {/* Profile (Your original design - UNCHANGED) */}
          <div className="border-t border-[#1CA9A3]/30 p-5 bg-gradient-to-b from-[#0F394D]/90 to-[#21B0BE]/90 flex items-center gap-3">
            <img
              src="https://randomuser.me/api/portsraits/women/45.jpg"
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

        {/* Main Upload Section (Your original design - UNCHANGED) */}
        <main className="flex-1 flex justify-center items-center bg-gradient-to-br from-[#F8FAFC] via-[#E9F1F4] to-[#E4EEF4] p-8 relative">
          {/* Back button (Your original design - UNCHANGED) */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-8 right-8 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] 
                         text-white px-5 py-2 rounded-full shadow hover:opacity-90 transition flex items-center gap-2 z-20"
          >
            Back
          </button>

          <div className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-[#CFE5EA] p-10">
            <div className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl bg-gradient-to-r from-[#0F394D] to-[#21B0BE]" />

            {/* Upload Form - Direct (No Department Selection) */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col items-center space-y-5"
            >
              <h2 className="text-2xl font-bold text-[#0F394D] mb-8 text-center mt-4">
                Upload Resume
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
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading} // Disable when uploading
                  />
                </label>
              </div>

              {/* MODIFIED: Show status or selected files */}
              {uploading ? (
                <div className="text-[#0F394D] text-sm bg-[#E9F1F4] px-3 py-2 rounded-lg w-full text-center flex items-center justify-center">
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  <span>{uploadStatus}</span>
                </div>
              ) : (
                files.length > 0 && (
                  <div className="text-[#0F394D] text-sm bg-[#E9F1F4] px-3 py-2 rounded-lg w-full text-center space-y-1">
                    <strong>Selected Files:</strong>
                    {files.map((f, i) => (
                      <p key={i}>{f.name}</p>
                    ))}
                  </div>
                )
              )}

              <button
                type="submit"
                disabled={uploading || files.length === 0} // Disable if no files
                className={`w-full py-3 rounded-lg text-white font-medium shadow-md transition duration-300 ${
                  uploading || files.length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90"
                }`}
              >
                {uploading ? (
                  "Processing..."
                ) : (
                  `Submit ${files.length} File(s)`
                )}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* --- ✅ NEW: Add the Modal component here --- */}
      <CustomAlertModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
      />
    </>
  );
};

// =====================================================
// ✅ NEW: THE CUSTOM MODAL COMPONENT
// =====================================================
const CustomAlertModal = ({ isOpen, title, message, type = "info", onClose }) => {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    info: <Info className="w-12 h-12 text-[#21B0BE]" />, // Your theme color
  };

  const buttonStyles = {
    // ✅ MODIFIED: Use your teal gradient for info and success
    info: "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90",
    success: "bg-gradient-to-r from-[#0F394D] to-[#21B0BE] hover:opacity-90", // Changed from green
    error: "bg-red-600 hover:bg-red-700",
  };

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Modal Panel (Your original design - UNCHANGED) */}
      <div className="relative w-full max-w-md p-6 bg-white rounded-2xl shadow-xl border border-gray-200 m-4">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          {icons[type]}
        </div>

        {/* Content */}
        <div className="mt-4 text-center">
          <h3 className="text-xl font-semibold leading-6 text-[#0F394D]" id="modal-title"> {/* ✅ Styled Title */}
            {title}
          </h3>
          <div className="mt-2">
            {/* Use 'whitespace-pre-line' to respect newlines from '\n' */}
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Button */}
        <div className="mt-6">
          <button
            type="button"
            className={`w-full inline-flex justify-center rounded-lg shadow-sm px-4 py-2 text-base font-medium text-white transition ${buttonStyles[type]}`}
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Upload;