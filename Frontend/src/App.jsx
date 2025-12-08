import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import RecruiterHome from "./pages/RecruiterHome";
import Upload from "./pages/Upload";
import Retrieve from "./pages/Retrieve";
import Manageresume from "./pages/Manageresume";
import Recruiterdashboard from "./pages/Recruiterdashboard";
import AnalyticsDetails from "./pages/Analyticsdetails";
import ViewResume from "./pages/ViewResume";
import JobDescriptionMatch from "./pages/JobDescriptionMatch";
// import Managerdashboard from "./pages/Managerdashboard";
import Managerpage from "./pages/Managerpage";
import Description from "./pages/Description";
import Preview from "./pages/Preview";
import Register from "./pages/register";
import Login from "./pages/login";
import PublishedJDs from "./pages/PublishedJDs"; // ✅ Correctly Imported
import Drafts from "./pages/Drafts";
import MatchedResume from "./pages/MatchedResume";
import ViewJD from "./pages/ViewJD";
import ManagerHome from "./pages/ManagerHome";
import RecruiterViewJDs from "./pages/RecruiterViewJDs";
 
function App() {
  const [jdData, setJdData] = useState(null);
 
  return (
    <Routes>
 
      {/* Login page is now the landing page */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} /> {/* Explicit /login route */}
      <Route path="/register" element={<Register />} />
 
      <Route path="/home" element={<RecruiterHome />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/retrieve" element={<Retrieve />} />
      <Route path="/manageresume" element={<Manageresume />} />
      <Route path="/recruiterdashboard" element={<Recruiterdashboard />} />
      <Route path="/analytics-details" element={<AnalyticsDetails />} />
      <Route path="/viewresume" element={<ViewResume />} />
      <Route path="/jobdescriptionmatch" element={<JobDescriptionMatch />} />
      {/* <Route path="/managerdashboard" element={<Managerdashboard />} /> */}
      <Route path="/managerpage" element={<Managerpage />} />
      <Route path="/drafts" element={<Drafts />} />
      <Route path="/matchedresume" element={<MatchedResume />} />
      <Route path="/managerhome" element={<ManagerHome />} />
      <Route path="/recruiter-jds" element={<RecruiterViewJDs />} />
 
      {/* ✅ Correct FIXED ROUTES */}
      <Route path="/view-job/:id" element={<ViewJD />} />
      <Route path="/view-job/:id/:title" element={<ViewJD />} />
 
      {/* Published JDs */}
      <Route path="/published-jds" element={<PublishedJDs />} />
 
      {/* Shared State Routes */}
      <Route
        path="/description"
        element={<Description jdData={jdData} setJdData={setJdData} />}
      />
 
      <Route
        path="/preview"
        element={<Preview jdData={jdData} setJdData={setJdData} />}
      />
    </Routes>
  );
}
 
export default App;
 
 