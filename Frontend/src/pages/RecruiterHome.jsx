import React, { useState } from "react";

import { useNavigate } from "react-router-dom";

import {

  UserPlus,

  SearchCheck,

  BarChart3,

  FolderOpen,

} from "lucide-react";
 
import RecruiterSidebar from "../components/sidebar/RecruiterSidebar";

import GlobalHeader from "../components/sidebar/GlobalHeader";
 
const RecruiterHome = () => {

  const navigate = useNavigate();
 
  // ⭐ Collapsed state to make layout adaptive (same as Upload.jsx)

  const [collapsed, setCollapsed] = useState(true);
 
  const menuItems = [

    {

      title: "Upload",

      icon: <UserPlus />,

      desc: "Upload and add a candidate profile to the system.",

      link: "/upload",

    },

    {

      title: "Retrieve",

      icon: <SearchCheck />,

      desc: "Find resumes using intelligent AI matching.",

      link: "/retrieve",

    },

    {

      title: "Dashboard",

      icon: <BarChart3 />,

      desc: "View hiring metrics and recruitment statistics.",

      link: "/recruiterdashboard",

    },

    {

      title: "Manage Resume",

      icon: <FolderOpen />,

      desc: "Browse all uploaded resumes.",

      link: "/manageresume",

    },

    {

      title: "JD Matcher",

      icon: <SearchCheck />,

      desc: "Match resumes with any uploaded Job Description.",

      link: "/jobdescriptionmatch",

    },

  ];
 
  return (
<div className="min-h-screen flex flex-col bg-gradient-to-br from-[#F5F9FC] via-[#ECF3F6] to-[#E6F0F5]">
 
      {/* Global Header */}
<GlobalHeader />
 
      {/* BELOW HEADER: FLEX LAYOUT */}
<div className="flex flex-1 pt-[24px]">
 
        {/* ⭐ Sidebar with collapsed state */}
<RecruiterSidebar active="Home" setCollapsed={setCollapsed} />
 
        {/* ⭐ Adaptive main content area */}
<main

          className="

            flex-1 

            p-4 sm:p-8 md:p-10 

            overflow-y-auto 

            transition-all 

            relative

          "

          style={{ marginLeft: collapsed ? "5rem" : "18rem" }}
>

          {/* Subtle Background Pattern */}
<div className="absolute inset-0 bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/dot-grid.png')] opacity-[0.07] pointer-events-none"></div>
 
          <div className="relative z-10 max-w-7xl mx-auto">
 
            {/* PAGE HEADER */}
<div className="mb-10 md:mb-12 mt-6">
<h1 className="text-3xl md:text-4xl font-extrabold text-[#0C1C26] flex items-center gap-2">

                Welcome, Recruiter <span className="text-4xl"></span>
</h1>
<p className="text-gray-600 mt-2 text-[14px] md:text-[15px]">

                Manage your entire recruitment workflow — upload, search, analyze, and organize resumes effortlessly.
</p>
</div>
 
            {/* ⭐ Adaptive Grid (same structure as Upload responsiveness) */}
<div

              className="

                grid 

                grid-cols-1 

                sm:grid-cols-2 

                md:grid-cols-2 

                lg:grid-cols-3 

                gap-6 

                md:gap-8 

                lg:gap-10

              "
>

              {menuItems.map((item, index) => (
<div

                  key={index}

                  onClick={() => navigate(item.link)}

                  className="

                    cursor-pointer 

                    p-6 md:p-7 

                    rounded-2xl 

                    bg-white 

                    border border-gray-200

                    hover:shadow-xl hover:-translate-y-2

                    transition-all duration-300 group

                  "
>
<div

                    className="

                      w-14 h-14 md:w-16 md:h-16

                      rounded-xl bg-[#F1F5F9]

                      flex items-center justify-center

                      text-[#073C4D] shadow-sm

                      group-hover:bg-[#E5EDF4]

                      transition-all

                    "
>

                    {React.cloneElement(item.icon, { size: 30 })}
</div>
 
                  <h3 className="text-lg md:text-xl font-semibold text-[#0D1F29] mt-5">

                    {item.title}
</h3>
 
                  <p className="text-gray-600 text-sm mt-2">

                    {item.desc}
</p>
</div>

              ))}
</div>
 
          </div>
</main>
</div>
</div>

  );

};
 
export default RecruiterHome;

 