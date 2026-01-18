import { Link } from "react-router-dom";
import "./Breadcrumb.css";

function Breadcrumb({ current }) {
  return (
    <div className="breadcrumb">
      <Link to="/" className="breadcrumb-home">Home</Link>
      <span className="breadcrumb-sep">›</span>
      <span className="breadcrumb-current">{current}</span>
    </div>
  );
}

export default Breadcrumb;
