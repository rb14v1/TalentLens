import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  Loader,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import { API_BASE_URL } from "../config";
 
// SHA-256 helper
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
 
const Upload = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
 
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };
 
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
 
        const uploadRes = await fetch(`${API_BASE_URL}/upload-resume/`, {
          method: "POST",
          body: formData,
        });
 
        const data = await uploadRes.json();
 
        if (!uploadRes.ok) {
          errorFiles.push(`${file.name}: ${data.error}`);
        } else {
          successFiles.push(file.name);
        }
      }
 
      let modal = { isOpen: true, type: "success" };
 
      if (successFiles.length)
        modal.message = `Uploaded:\n- ${successFiles.join("\n- ")}\n\n`;
 
      if (duplicateFiles.length) {
        modal.message += `Skipped duplicates:\n- ${duplicateFiles.join("\n- ")}\n\n`;
        modal.type = "info";
      }
 
      if (errorFiles.length) {
        modal.message += `Failed:\n- ${errorFiles.join("\n- ")}`;
        modal.type = "error";
      }
 
      modal.title =
        successFiles.length > 0
          ? "Upload Complete"
          : duplicateFiles.length > 0
          ? "Files Already Exist"
          : "Upload Failed";
 
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
    <>
      <div className="min-h-screen flex bg-[#F5F5F5]">
       
        {/* Sidebar */}
        <RecruiterSidebar active="Upload" />
 
        {/* Main section */}
        <main className="flex-1 ml-72 p-10 relative overflow-y-auto">
         
          {/* Back button */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-8 right-8 bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
                       text-white px-7 py-2 rounded-full shadow-lg hover:shadow-xl
                       transition"
          >
            Back
          </button>
 
          {/* Card */}
          <div className="max-w-lg mx-auto bg-white shadow-xl p-10 rounded-2xl border">
            <h2 className="text-2xl font-bold text-center mb-6 text-[#0F394D]">
              Upload Resume
            </h2>
 
            <form onSubmit={handleSubmit} className="space-y-6">
 
              {/* ⭐ FIXED — CENTERED UPLOAD BOX */}
              <div
                className="
                  border-2 border-dashed border-[#21B0BE]/40
                  rounded-xl
                  h-64
                  flex flex-col items-center justify-center
                  text-center
                  hover:border-[#21B0BE]
                  transition
                "
              >
                <UploadCloud className="text-[#21B0BE] w-14 h-14 mb-4" />
 
                <p className="text-gray-600 text-lg">Drag & Drop files</p>
                <p className="text-gray-400 text-sm mb-4">or</p>
 
                <label className="cursor-pointer">
                  <span
                    className="
                      bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
                      px-8 py-2
                      rounded-full
                      text-white
                      font-medium
                      shadow-md
                      hover:shadow-lg
                      transition
                    "
                  >
                    Browse
                  </span>
 
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
 
              {/* Status */}
              {uploading ? (
                <div className="flex items-center justify-center p-2 bg-gray-100 rounded-lg text-[#073C4D]">
                  <Loader className="animate-spin w-4 h-4 mr-2" />
                  {uploadStatus}
                </div>
              ) : (
                files.length > 0 && (
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <strong>Selected Files:</strong>
                    {files.map((f, i) => (
                      <p key={i}>{f.name}</p>
                    ))}
                  </div>
                )
              )}
 
              {/* Upload button */}
              <button
                type="submit"
                disabled={uploading || !files.length}
                className={`w-full py-3 rounded-lg text-white shadow
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
 
      {/* Modal */}
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
          className="w-full mt-6 py-2 bg-gradient-to-r from-[#073C4D] to-[#1AB8C0]
                     text-white rounded-lg"
        >
          OK
        </button>
      </div>
    </div>
  );
};
 
export default Upload;
 
 
 