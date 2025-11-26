// src/pages/Drafts.jsx
 
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Upload } from "lucide-react";
import { API_BASE_URL } from "../config";
import HiringManagerSidebar from "../components/sidebar/HiringManagerSidebar";
 
const Drafts = () => {
  const [drafts, setDrafts] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
 
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.email) {
      fetchDrafts(user.email);
    }
  }, []);
 
  const fetchDrafts = async (email) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jd/drafts/${email}/`);
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (err) {
      console.error("Error loading drafts:", err);
    }
  };
 
  const deleteDraft = async (id) => {
    await fetch(`${API_BASE_URL}/jd/draft/delete/${id}/`, {
      method: "DELETE",
    });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };
 
  const editDraft = (draft) => {
    navigate("/description", { state: { jdData: draft.data } });
  };
 
  const publishDraft = async (draft) => {
    await fetch(`${API_BASE_URL}/jd/draft/publish/${draft.id}/`, {
      method: "POST",
    });
    alert("Draft Published Successfully!");
    navigate("/managerdashboard");
  };
 
  return (
    <div className="flex min-h-screen bg-[#F8FAF9]">
      <HiringManagerSidebar setCollapsed={setCollapsed} />
 
      <main
        className={`flex-1 transition-all duration-300 p-10 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        <h1 className="text-4xl font-bold text-center text-[#073C4D] mb-12 tracking-wide">
          Draft Job Descriptions
        </h1>
 
        {drafts.length === 0 ? (
          <p className="text-[#073C4D]/60 text-lg italic text-center">
            No draft job descriptions available.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="
                  bg-white
                  rounded-3xl
                  border border-[#E6F4F5]
                  p-8
                  shadow-[0_4px_12px_rgba(0,0,0,0.05)]
                  hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)]
                  transition-all
                  duration-300
                "
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-[#073C4D]">
                    {draft.title}
                  </h3>
 
                  <span
                    className="
                      px-4 py-1
                      rounded-full
                      text-sm font-semibold
                      text-white
                      bg-gradient-to-r from-[#0F394D] to-[#1CA3A3]
                      shadow-sm
                    "
                  >
                    Draft
                  </span>
                </div>
 
                <p className="text-[#073C4D]/60 text-sm mb-1">
                  Last Updated: {new Date(draft.updated_at).toLocaleString()}
                </p>
 
                <p className="text-[#073C4D]/80 text-sm mt-3 line-clamp-2">
                  {draft.data?.summary || "No description available"}
                </p>
 
                <div className="flex gap-4 mt-8 text-sm font-medium">
 
                  {/* ✅ EDIT BUTTON */}
                  <button
                    onClick={() => editDraft(draft)}
                    className="
                      flex items-center gap-2
                      bg-[#0F394D]
                      text-white
                      px-4 py-2
                      rounded-full
                      hover:bg-[#062A36]
                      shadow-sm
                      transition
                    "
                  >
                    <Pencil size={16} /> Edit
                  </button>
 
                  {/* ✅ DELETE BUTTON */}
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="
                      flex items-center gap-2
                      bg-black
                      text-white
                      px-4 py-2
                      rounded-full
                      hover:bg-[#222]
                      shadow-sm
                      transition
                    "
                  >
                    <Trash2 size={16} /> Delete
                  </button>
 
                  {/* ✅ PUBLISH BUTTON */}
                  <button
                    onClick={() => publishDraft(draft)}
                    className="
                      flex items-center gap-2
                      bg-[#1CA3A3]
                      text-white
                      px-4 py-2
                      rounded-full
                      hover:bg-[#147A7A]
                      shadow-sm
                      transition
                    "
                  >
                    <Upload size={16} /> Publish
                  </button>
 
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
 
export default Drafts;
 
 