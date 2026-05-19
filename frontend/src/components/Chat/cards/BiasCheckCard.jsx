import React from 'react';
import { IconShield, IconCheck } from '../icons';

/**
 * BiasCheckCard — repurposed as a small "inclusivity passed" pill in the
 * left rail. The detailed diff lives inside FinalJDCard (canvas side).
 * Only rendered when biasCard.clean === true (MessageList enforces this).
 */
const BiasCheckCard = ({ data }) => {
    if (!data || !data.clean) return null;
    return (
        <span className="inclusivity-pill" role="status">
            <IconShield size={14} />
            <IconCheck size={14} />
            Inclusivity check passed
        </span>
    );
};

export default BiasCheckCard;
