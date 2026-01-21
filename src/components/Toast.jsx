import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast-notification ${type}`}>
            <span>{message}</span>
        </div>
    );
};

export default Toast;
