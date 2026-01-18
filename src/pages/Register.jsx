import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "./Register.css";

export default function Register() {
  const [formData, setFormData] = useState({
    candidateName: "",
    cicNumber: "",
    team: "",
    onStageEvents: [],
    offStageEvents: []
  });

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chestNumber, setChestNumber] = useState("");
  const [errors, setErrors] = useState({});

  // Fetch events from Firestore
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const q = query(collection(db, "events"), orderBy("name"));
        const snapshot = await getDocs(q);
        const eventList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEvents(eventList);
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };
    fetchEvents();
  }, []);

  const onStageEvents = events.filter(e => (e.type || "On Stage") === "On Stage");
  const offStageEvents = events.filter(e => e.type === "Off Stage");

  // Generate unique chest number
  const generateChestNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `CH${timestamp}${random}`;
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.candidateName.trim()) {
      newErrors.candidateName = "Name is required";
    }

    if (!formData.cicNumber.trim()) {
      newErrors.cicNumber = "CIC Number is required";
    }

    if (!formData.team) {
      newErrors.team = "Please select a team";
    }

    if (formData.onStageEvents.length === 0 && formData.offStageEvents.length === 0) {
      newErrors.events = "Please select at least one event";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const generatedChestNumber = generateChestNumber();

      await addDoc(collection(db, "registrations"), {
        ...formData,
        chestNumber: generatedChestNumber,
        timestamp: new Date(),
      });

      setChestNumber(generatedChestNumber);
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting registration:", error);
      setErrors({ submit: "Failed to submit registration. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Handle event selection
  const toggleEvent = (eventId, type) => {
    const field = type === "On Stage" ? "onStageEvents" : "offStageEvents";
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(eventId)
        ? prev[field].filter(id => id !== eventId)
        : [...prev[field], eventId]
    }));
  };

  // Reset form
  const handleReset = () => {
    setFormData({
      candidateName: "",
      cicNumber: "",
      team: "",
      onStageEvents: [],
      offStageEvents: []
    });
    setSubmitted(false);
    setChestNumber("");
    setErrors({});
  };

  if (submitted) {
    return (
      <div className="container register-page">
        <div className="success-card">
          <div className="success-icon">✨</div>
          <h2 className="success-title">Registration Successful!</h2>
          <p className="success-message">
            Welcome to AHAM Arts Fest, <strong>{formData.candidateName}</strong>!
          </p>

          <div className="chest-display">
            <label>Your Chest Number</label>
            <div className="chest-number">{chestNumber}</div>
          </div>

          <div className="success-details">
            <div className="detail-row">
              <span className="detail-label">Team:</span>
              <span className={`team-badge team-${formData.team}`}>{formData.team}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">CIC Number:</span>
              <span>{formData.cicNumber}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Events Enrolled:</span>
              <span>{formData.onStageEvents.length + formData.offStageEvents.length}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={handleReset}>
            Register Another Participant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container register-page">
      <header className="register-header">
        <h2 className="register-title">Festival Registration</h2>
        <div className="live-status">
          <span className="live-dot"></span>
          Open for Enrollment
        </div>
      </header>

      <form className="register-form" onSubmit={handleSubmit}>
        {/* Personal Information */}
        <section className="form-section">
          <h3 className="section-title">Personal Information</h3>

          <div className="form-group">
            <label htmlFor="candidateName">Full Name *</label>
            <input
              id="candidateName"
              type="text"
              className={`form-input ${errors.candidateName ? 'error' : ''}`}
              placeholder="Enter your full name"
              value={formData.candidateName}
              onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
            />
            {errors.candidateName && <span className="error-message">{errors.candidateName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="cicNumber">CIC Number *</label>
            <input
              id="cicNumber"
              type="text"
              className={`form-input ${errors.cicNumber ? 'error' : ''}`}
              placeholder="Enter your CIC number"
              value={formData.cicNumber}
              onChange={(e) => setFormData({ ...formData, cicNumber: e.target.value })}
            />
            {errors.cicNumber && <span className="error-message">{errors.cicNumber}</span>}
          </div>
        </section>

        {/* Team Selection */}
        <section className="form-section">
          <h3 className="section-title">Select Your Team *</h3>
          {errors.team && <span className="error-message">{errors.team}</span>}

          <div className="team-selection">
            {["PYRA", "IGNIS", "ATASH"].map((team) => (
              <div
                key={team}
                className={`team-card team-${team} ${formData.team === team ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, team })}
              >
                <div className="team-icon">🔥</div>
                <h4 className="team-name">{team}</h4>
                <div className="team-check">
                  {formData.team === team && "✓"}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Event Selection */}
        <section className="form-section">
          <h3 className="section-title">Select Events *</h3>
          {errors.events && <span className="error-message">{errors.events}</span>}

          {/* On Stage Events */}
          <div className="event-category">
            <h4 className="category-label">🎭 On Stage Events</h4>
            <div className="event-grid">
              {onStageEvents.map((event) => (
                <label key={event.id} className="event-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.onStageEvents.includes(event.id)}
                    onChange={() => toggleEvent(event.id, "On Stage")}
                  />
                  <span className="checkbox-label">{event.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Off Stage Events */}
          <div className="event-category">
            <h4 className="category-label">📝 Off Stage Events</h4>
            <div className="event-grid">
              {offStageEvents.map((event) => (
                <label key={event.id} className="event-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.offStageEvents.includes(event.id)}
                    onChange={() => toggleEvent(event.id, "Off Stage")}
                  />
                  <span className="checkbox-label">{event.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <div className="form-actions">
          {errors.submit && <span className="error-message">{errors.submit}</span>}
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Submitting...
              </>
            ) : (
              "Complete Registration"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
