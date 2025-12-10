// Frontend/src/pages/RecruiterViewJDs.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Briefcase, MapPin, Calendar, ArrowRight, Loader } from "lucide-react";
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";
import { API_BASE_URL } from "../config";
import GlobalHeader from "../components/sidebar/GlobalHeader";

const RecruiterViewJDs = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  
  // Data States
  const [jobs, setJobs] = useState([]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [loading, setLoading] = useState(true);

  // ✅ FIXED: Use Ref for offset to prevent closure staleness
  const nextOffsetRef = useRef(0);
  
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // ================= FETCH JOBS =================
  const fetchJobs = useCallback(async (isInitial = false, deptOverride = null) => {
    const deptToFetch = deptOverride !== null ? deptOverride : selectedDept;

    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      const limit = 12;
      // Read directly from Ref
      const offset = isInitial ? 0 : nextOffsetRef.current; 

      // If strictly not initial and offset is null, stop (Safety check)
      if (!isInitial && offset === null) {
          setIsFetchingMore(false);
          return;
      }
      
      const url = `${API_BASE_URL}/jobs/list/?limit=${limit}&offset=${offset}&department=${encodeURIComponent(deptToFetch)}`;

      const res = await fetch(url, { credentials: "include" });
      
      if (res.ok) {
        const data = await res.json();
        
        const newJobs = data.results || [];
        const newOffset = data.next_offset; 

        // Update Ref immediately
        nextOffsetRef.current = newOffset;

        setJobs((prev) => {
            // Deduplicate based on ID just in case
            const existingIds = new Set(isInitial ? [] : prev.map(j => j.id));
            const uniqueNewJobs = newJobs.filter(j => !existingIds.has(j.id));
            return isInitial ? newJobs : [...prev, ...uniqueNewJobs];
        });

        // If backend sends null, we are done.
        setHasMore(newOffset !== null);
      }
    } catch (e) {
      console.error("Failed to load JDs", e);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [selectedDept]); // Removed nextOffset from dependencies

  // Initial Load
  useEffect(() => {
    // Reset Ref on mount or dept change
    nextOffsetRef.current = 0; 
    setHasMore(true);
    fetchJobs(true);
  }, [fetchJobs]); // fetchJobs only changes when selectedDept changes now

  // ================= SCROLL OBSERVER =================
  const observer = useRef();
  const lastJobRef = useCallback(
    (node) => {
      if (loading || isFetchingMore) return;
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
           // Double check we actually have an offset to fetch
           if (nextOffsetRef.current !== null) {
               fetchJobs(false); 
           }
        }
      });
      
      if (node) observer.current.observe(node);
    },
    [loading, isFetchingMore, hasMore, fetchJobs]
  );

  // ================= FILTER HANDLER =================
  const handleFilter = (dept) => {
    setSelectedDept(dept);
    setJobs([]); 
    nextOffsetRef.current = 0; // Reset Ref
    setHasMore(true); 
    // Effect will trigger fetchJobs because selectedDept changed
  };

  const handleMatch = (job) => {
    navigate("/jobdescriptionmatch", { 
        state: { 
            jobId: job.id, 
            fileName: job.file_name || "JobDescription.pdf" 
        } 
    });
  };

  const departments = ["All", "Engineering / IT", "Human Resources", "Sales & Marketing", "Finance & Accounting"];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#E9F1F4] to-[#F8FAFC]">
      <GlobalHeader />

      <div className="flex flex-1 pt-[90px]">
        <RecruiterSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

        <div 
          className={`flex-1 transition-all duration-300 ${
            collapsed ? "ml-20" : "ml-64"
          } p-8 overflow-y-auto`}
        >
          <div className="max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#0D1F29]">Job Descriptions</h1>
                <p className="text-gray-500 mt-1">Browse open roles and match candidates.</p>
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  value={selectedDept}
                  onChange={(e) => handleFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-[#21B0BE] outline-none text-sm font-medium text-gray-700 cursor-pointer appearance-none min-w-[200px]"
                >
                  {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
            </div>

            {/* Content */}
            {loading && jobs.length === 0 ? (
              <div className="flex justify-center py-20"><Loader className="animate-spin text-[#21B0BE]" size={40} /></div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-500">No Job Descriptions found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {jobs.map((job, index) => {
                    const isLast = jobs.length === index + 1;
                    return (
                      <div 
                        key={job.id} 
                        ref={isLast ? lastJobRef : null}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0F394D] to-[#21B0BE] opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex justify-between items-start mb-4">
                          <div>
                              <h3 className="font-bold text-lg text-[#0D1F29] line-clamp-1">{job.title}</h3>
                              <p className="text-xs text-gray-500 font-medium mt-1 bg-gray-50 inline-block px-2 py-1 rounded">
                                  {job.department}
                              </p>
                          </div>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Briefcase size={16} className="text-[#21B0BE]" />
                              <span>{job.type || "Full-time"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin size={16} className="text-[#21B0BE]" />
                              <span>{job.location || "Remote"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar size={16} className="text-[#21B0BE]" />
                              <span>Posted: {job.created_at}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleMatch(job)}
                          className="w-full py-2.5 rounded-xl bg-[#E0F7FA] text-[#00838F] font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-[#21B0BE] group-hover:text-white transition-all"
                        >
                          Match Candidates <ArrowRight size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Loader */}
                {isFetchingMore && (
                   <div className="flex justify-center py-8">
                      <Loader className="animate-spin text-[#21B0BE]" size={32} />
                   </div>
                )}
                
                {/* End of List Message - STRICT CHECK */}
                {!hasMore && !isFetchingMore && jobs.length > 0 && (
                   <p className="text-center text-gray-400 text-sm mt-8 pb-10">End of list.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruiterViewJDs;