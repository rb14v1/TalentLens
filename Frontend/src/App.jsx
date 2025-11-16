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
  return (
    <Routes>
      <Route path="/" element={<RecruiterHome />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/retrieve" element={<Retrieve />} />
      <Route path="/manageresume" element={<Manageresume />} />
      <Route path="/recruiterdashboard" element={<Recruiterdashboard />} />
      <Route path="/analytics-details" element={<AnalyticsDetails />} />
      <Route path="/viewresume" element={<ViewResume/>} />
      <Route path="/jobdescriptionmatch" element={<JobDescriptionMatch/>} />
      <Route path="/managerdashboard" element={<Managerdashboard/>} />
      <Route path="/managerpage" element={<Managerpage/>} />
      <Route path="/description" element={<Description/>} />
      <Route path="/preview" element={<Preview/>} />
    </Routes>
  );
}

export default App;
