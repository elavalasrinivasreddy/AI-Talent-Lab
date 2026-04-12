// components/Sidebar/AnalyticsLink.jsx
export default function AnalyticsLink() {
    return (
        <a
            className="analytics-link"
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Dashboard in new tab"
        >
            <span className="analytics-icon">📊</span>
            <span>Dashboard</span>
            <span className="analytics-ext-icon">↗</span>
        </a>
    );
}
