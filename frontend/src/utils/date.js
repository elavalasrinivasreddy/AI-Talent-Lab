export function timeAgo(dateString) {
  if (!dateString) return '';
  
  // If the backend sends a naive string (e.g. "2026-05-30T13:52:23") 
  // append 'Z' to force UTC parsing.
  const ds = dateString.endsWith('Z') || dateString.includes('+') 
    ? dateString 
    : dateString + 'Z';
    
  const diff = Date.now() - new Date(ds).getTime();
  const mins = Math.floor(diff / 60_000);
  
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
