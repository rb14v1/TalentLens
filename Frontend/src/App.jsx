import React, { useState } from "react"; // <-- 1. Import useState
import { Routes, Route } from "react-router-dom";
import RecruiterHome from "./pages/RecruiterHome";
import Upload from "./pages/Upload";
import Retrieve from "./pages/Retrieve";
import Manageresume from "./pages/Manageresume";
import Recruiterdashboard from "./pages/Recruiterdashboard";
import AnalyticsDetails from "./pages/Analyticsdetails";
import ViewResume from "./pages/ViewResume";
import JobDescriptionMatch from "./pages/JobDescriptionMatch";
import Managerdashboard from "./pages/Managerdashboard";
import Managerpage from "./pages/Managerpage";
import Description from "./pages/Description";
import Preview from "./pages/Preview";

function App() {
  // --- 2. Create the shared state here ---
  const [jdData, setJdData] = useState(null);

  return (
    <Routes>
      <Route path="/" element={<RecruiterHome />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/retrieve" element={<Retrieve />} />
      <Route path="/manageresume" element={<Manageresume />} />
      <Route path="/recruiterdashboard" element={<Recruiterdashboard />} />
      <Route path="/analytics-details" element={<AnalyticsDetails />} />
      <Route path="/viewresume" element={<ViewResume />} />
      <Route path="/jobdescriptionmatch" element={<JobDescriptionMatch />} />
      <Route path="/managerdashboard" element={<Managerdashboard />} />
      <Route path="/managerpage" element={<Managerpage />} />
      
      {/* --- 3. Pass the state and function as props --- */}
      <Route
        path="/description"
        element={<Description jdData={jdData} setJdData={setJdData} />}
      />

      {/* --- 4. Pass the data to the Preview page --- */}
      <Route
        path="/preview"
        element={<Preview jdData={jdData} setJdData={setJdData} />} // Pass setJdData here too
      />
    </Routes>
  );
}

export default App;