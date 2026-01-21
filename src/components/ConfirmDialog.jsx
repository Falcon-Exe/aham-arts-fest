import React from 'react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="confirm-overlay" onClick={onCancel}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-message">{message}</div>
                <div className="confirm-actions">
                    <button className="confirm-btn confirm-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="confirm-btn confirm-ok" onClick={onConfirm}>
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
