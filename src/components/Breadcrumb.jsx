import { Link, useLocation } from "react-router-dom";
import "./Breadcrumb.css";

function Breadcrumb({ current }) {
  const location = useLocation();
  
  // Get the first part of the path, replace dashes with spaces, and capitalize words
  const pathName = location.pathname.split("/").filter(Boolean)[0] || "";
  const formattedPath = pathName
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  // Use passed prop or fallback to capitalized path name
  const displayCurrent = current || formattedPath || "Page";

  return (
    <div className="breadcrumb">
      <Link to="/" className="breadcrumb-home">Home</Link>
      <span className="breadcrumb-sep">›</span>
      <span className="breadcrumb-current">{displayCurrent}</span>
    </div>
  );
}

export default Breadcrumb;
