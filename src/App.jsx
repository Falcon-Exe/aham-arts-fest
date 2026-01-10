import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Registration from "./pages/Registration";
import Schedule from "./pages/Schedule";
import Results from "./pages/Results";
import Participants from "./pages/Participants";


function App() {
  return (
    <Router>
      <Navbar />  {/* Only here */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<Events />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/results" element={<Results />} />
        <Route path="/participants" element={<Participants />} />
      </Routes>
    </Router>
  );
}

export default App;
