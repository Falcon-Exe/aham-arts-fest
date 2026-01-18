import "./Register.css";
import Breadcrumb from "../components/Breadcrumb";

export default function Register() {
  return (
    
    <div style={{ padding: "20px" }}>
      <h2>Candidate Registration</h2>

<iframe
  className="register-frame"
  src="https://docs.google.com/forms/d/e/1FAIpQLSfIbR6Bqj-kBTtH8-d2BcqdYPDFnmV27IqLqJi7BH9M-biNIA/viewform?embedded=true"
  title="Candidate Registration Form"
  frameBorder="0"
>
  Loading…
</iframe>
<div className="container">
      <Breadcrumb current="Results" />

      {/* existing results content */}
    </div>
    </div>
  );
}
