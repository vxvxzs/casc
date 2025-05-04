// Modal.tsx
import React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Upload Your Telemetry File</h2>
        <p>Follow these simple steps to find your telemetry:</p>

        <div className="steps">
          <div className="step">
            <h3>1. Le Mans Ultimate</h3>
            <p>Enable telemetry recording in <code>player.JSON</code> (search for "Record To Disk" and set it to true).</p>
            <p>Telemetry location:</p>
            <code>Documents\rFactor2\Replays\Telemetry</code>
          </div>

          <div className="step">
            <h3>2. Assetto Corsa Competizione</h3>
            <p>Telemetry is automatically recorded.</p>
            <p>Telemetry location:</p>
            <code>Documents\Assetto Corsa Competizione\telemetry</code>
          </div>

          <div className="step">
            <h3>3. iRacing</h3>
            <p>Telemetry is automatically recorded.</p>
            <p>Telemetry location:</p>
            <code>Documents\iRacing\telemetry</code>
          </div>
        </div>
        
        <p>Make sure telemetry recording is enabled in your game settings!</p>

        <button className="modal-button" onClick={onClose}>Got it!</button>
      </div>
    </div>
  );
};

export default Modal;
