"""
routers/chat.py – API Endpoints for the Recruiter JD Generation chat.
Includes SSE streaming for `/stream` and endpoints to save final position.
"""
import uuid
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Body, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.services.chat_service import ChatService
from backend.db.repositories.sessions import ChatSessionRepository

router = APIRouter(prefix="/api/v1/chat", tags=["Recruiter Chat"])


class StreamRequest(BaseModel):
    session_id: str
    message: Optional[str] = None
    action: Optional[str] = None
    action_data: Optional[dict[str, Any]] = None
    department_id: Optional[int] = None


class SavePositionRequest(BaseModel):
    department_id: int
    headcount: int = 1
    priority: str = "normal"
    ats_threshold: float = 80.0
    search_interval_hours: int = 24
    role_name: Optional[str] = None


@router.get("/sessions")
async def list_sessions(user=Depends(get_current_user)):
    """List recent recruiter JD chat sessions."""
    sessions = await ChatSessionRepository.list_by_user(user["user_id"], user["org_id"])
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user=Depends(get_current_user)):
    """Get full state of a session."""
    session = await ChatSessionRepository.get(session_id, user["org_id"])
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    """Delete a draft session."""
    success = await ChatSessionRepository.delete(session_id, user["org_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or already deleted")
    return {"status": "ok"}


@router.patch("/sessions/{session_id}/title")
async def update_session_title(
    session_id: str,
    title: str = Body(..., embed=True),
    user=Depends(get_current_user)
):
    await ChatSessionRepository.update_title(session_id, user["org_id"], title)
    return {"status": "ok"}


@router.post("/stream")
async def run_chat_stream(
    req: StreamRequest,
    request: Request,
    user=Depends(get_current_user)
):
    """
    Main conversation endpoint using Server-Sent Events (SSE).
    Either forwards a message, or an action (e.g. `accept_internal`).
    """
    if await request.is_disconnected():
        return
        
    # Ensure session exists and org context is loaded
    await ChatService.get_or_create_session(
        session_id=req.session_id,
        org_id=user["org_id"],
        user_id=user["user_id"],
        department_id=req.department_id
    )

    # Return SSE Response
    generator = ChatService.run_chat_stream(
        session_id=req.session_id,
        org_id=user["org_id"],
        user_message=req.message,
        action=req.action,
        action_data=req.action_data
    )
    
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )


@router.post("/sessions/{session_id}/upload")
async def upload_reference_jd(
    session_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Upload a reference JD file (PDF/DOCX) to pre-fill context."""
    # To be implemented completely if required. Right now we can just read text.
    import PyPDF2
    
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF supported currently")
        
    try:
        reader = PyPDF2.PdfReader(file.file)
        text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        
        # We need to save this text to the state.
        session = await ChatSessionRepository.get(session_id, user["org_id"])
        if not session:
            # Create if not exists
            await ChatService.get_or_create_session(session_id, user["org_id"], user["user_id"])
            session = await ChatSessionRepository.get(session_id, user["org_id"])
            
        state = session.get("graph_state_parsed", {})
        state["reference_jd_text"] = text
        await ChatSessionRepository.update_state(session_id, user["org_id"], state.get("stage", "intake"), state)
        
        return {"status": "ok", "message": "File parsed and added to context."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File parse error: {str(e)}")


@router.post("/sessions/{session_id}/save-position")
async def save_position(
    session_id: str,
    req: SavePositionRequest,
    user=Depends(get_current_user)
):
    """Save the final JD into a real Position."""
    try:
        position = await ChatService.finish_and_save_position(
            session_id=session_id,
            org_id=user["org_id"],
            user_id=user["user_id"],
            setup_data=req.model_dump()
        )
        return {"status": "ok", "position_id": position["id"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
