// components/Sidebar/UserProfile.jsx
import { useEffect } from 'react';

const USER_NAME = import.meta.env.VITE_USER_NAME || 'Elavala';
const USER_EMAIL = import.meta.env.VITE_USER_EMAIL || 'elavala@aitalentlab.com';

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UserProfile() {
    return (
        <div className="user-profile">
            <div className="avatar">{getInitials(USER_NAME)}</div>
            <div className="user-info">
                <div className="user-name">{USER_NAME}</div>
                <div className="user-email">{USER_EMAIL}</div>
            </div>
        </div>
    );
}
