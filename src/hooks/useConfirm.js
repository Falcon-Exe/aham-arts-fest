import { useState } from 'react';

export const useConfirm = () => {
    const [confirmState, setConfirmState] = useState(null);

    const confirm = (message) => {
        return new Promise((resolve) => {
            setConfirmState({
                message,
                onConfirm: () => {
                    setConfirmState(null);
                    resolve(true);
                },
                onCancel: () => {
                    setConfirmState(null);
                    resolve(false);
                }
            });
        });
    };

    return { confirm, confirmState };
};
