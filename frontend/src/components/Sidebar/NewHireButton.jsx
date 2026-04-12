// components/Sidebar/NewHireButton.jsx
export default function NewHireButton({ onClick }) {
    return (
        <button className="new-hire-btn" onClick={onClick}>
            <span>✦</span>
            New Hire
        </button>
    );
}
