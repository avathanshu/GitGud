import ReactionGame from "./components/ReactionGame";
import { useNavigate } from "react-router-dom";
import "./AimTrainer.css";

export default function ReactionTrainer() {
  const navigate = useNavigate();

  return (
    <div className="aimtrainer-page">
      <div className="aim-wrapper">
        <button
          onClick={() => navigate("/practice")}
          className="back-button"
        >
          ← Back
        </button>

        <ReactionGame />
      </div>
    </div>
  );
}