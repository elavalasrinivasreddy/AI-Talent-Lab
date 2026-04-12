// components/ChatWindow/ChatWindow.jsx
import ChatTopBar from './ChatTopBar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatWindow() {
    return (
        <main className="chat-window">
            <ChatTopBar />
            <MessageList />
            <MessageInput />
        </main>
    );
}
