"""
routers/chat.py – Chat-related API endpoints (with SSE streaming)
"""
import traceback
import sys
import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import backend.session_store as session_store
from backend.agent import HiringAgent
from backend.routers.auth import get_current_user, decode_token
from backend.config import DEBUG
import PyPDF2
import io

router = APIRouter(prefix="/api/chat", tags=["chat"])
hiring_agent = HiringAgent()


# ── Request / Response Models ──────────────────────────────────────────────────

class MessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class MessageResponse(BaseModel):
    session_id: str
    title: str
    title_updated: bool
    reply: str
    ready_to_generate: bool
    requests_upload: bool = False
    
    # Multi-Agent UI fields
    workflow_stage: Optional[str] = None
    internal_recommendations: Optional[dict] = None
    market_recommendations: Optional[dict] = None
    competitors: Optional[list] = None
    baseline_requirements: Optional[str] = None
    final_jd_markdown: Optional[str] = None
    jd_overviews: Optional[list] = None


# ── SSE Streaming Endpoint ─────────────────────────────────────────────────────

@router.post("/stream")
async def stream_message(request: MessageRequest, req: Request):
    """
    SSE streaming endpoint. Streams tokens from the LLM in real-time.
    
    Events:
      event: token     → data: "text chunk"
      event: metadata  → data: {json object with workflow state}
      event: error     → data: "error message"
      event: done      → data: {json final state}
    """
    # Extract user from auth header (inline, not via Depends to avoid conflicts)
    user = None
    try:
        auth_header = req.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            user = decode_token(auth_header.split(" ", 1)[1])
            print(f"🔑 Stream auth OK | org_id={user.get('org_id')} | email={user.get('email')}", file=sys.stderr)
        else:
            print(f"⚠️ Stream: No Bearer token in Authorization header", file=sys.stderr)
    except Exception as e:
        print(f"❌ Stream auth failed: {e}", file=sys.stderr)

    def event_generator():
        try:
            for event in hiring_agent.run_stream(
                session_id=request.session_id,
                user_message=request.message,
                user=user,
            ):
                event_type = event.get("event", "token")
                data = event.get("data", "")
                
                if isinstance(data, dict):
                    data_str = json.dumps(data, ensure_ascii=False)
                else:
                    data_str = str(data)
                
                # SSE format: each line prefixed, double newline to end
                yield f"event: {event_type}\ndata: {data_str}\n\n"
                
        except Exception as e:
            print(f"❌ SSE stream error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            error_msg = str(e)
            yield f"event: error\ndata: {json.dumps({'error': error_msg})}\n\n"
        finally:
            yield "event: close\ndata: {}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Legacy Non-Streaming Endpoint ─────────────────────────────────────────────

@router.post("/message", response_model=MessageResponse)
async def send_message(request: MessageRequest):
    """
    Non-streaming endpoint (legacy). Returns complete response at once.
    """
    try:
        result = hiring_agent.run(
            session_id=request.session_id,
            user_message=request.message,
        )
        return MessageResponse(
            session_id=result["session_id"],
            title=result["title"],
            title_updated=result["title_updated"],
            reply=result["reply"],
            ready_to_generate=result["ready_to_generate"],
            requests_upload=result.get("requests_upload", False),
            
            workflow_stage=result.get("workflow_stage"),
            internal_recommendations=result.get("internal_recommendations"),
            market_recommendations=result.get("market_recommendations"),
            competitors=result.get("competitors"),
            baseline_requirements=result.get("baseline_requirements"),
            final_jd_markdown=result.get("final_jd_markdown"),
            jd_overviews=result.get("jd_overviews"),
        )
    except Exception as e:
        print(f"❌ Error in send_message: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        error_detail = str(e)
        if DEBUG:
            error_detail += f"\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


# ── Session Management ─────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions():
    """List all chat sessions (for sidebar history)."""
    return {"sessions": session_store.list_sessions()}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get full message history and workflow state for a session."""
    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get graph state for workflow card restoration
    graph_state = session_store.get_graph_state(session_id)

    return {
        "id": session["id"],
        "title": session["title"],
        "messages": [
            m for m in session["messages"]
            if m["role"] in ("user", "assistant")
        ],
        "jd_overviews": session.get("jd_overviews") or graph_state.get("jd_overviews"),
        "selected_overview": session.get("selected_overview"),
        "full_jd": session.get("full_jd") or graph_state.get("final_jd_markdown"),
        # Workflow state for history replay
        "workflow_stage": graph_state.get("workflow_stage", "intake"),
        "internal_recommendations": graph_state.get("internal_recommendations"),
        "market_recommendations": graph_state.get("market_recommendations"),
        "competitors": graph_state.get("competitors"),
        "final_jd_markdown": graph_state.get("final_jd_markdown"),
        # Accepted skills (for restoring card state in history)
        "accepted_internal_skills": graph_state.get("accepted_internal_skills"),
        "accepted_market_skills": graph_state.get("accepted_market_skills"),
    }



@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session."""
    deleted = session_store.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}

class UpdateTitleRequest(BaseModel):
    title: str

@router.patch("/sessions/{session_id}/title")
async def update_session_title(session_id: str, req: UpdateTitleRequest):
    """Update a chat session title."""
    if not session_store.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    session_store.update_title(session_id, req.title)
    return {"success": True, "title": req.title}

from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File, BackgroundTasks

@router.put("/sessions/{session_id}/jd")
async def save_jd(session_id: str, body: dict, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Save or update the JD markdown for a session (also updates the position)."""
    jd_markdown = body.get("jd_markdown", "")
    if not jd_markdown:
        raise HTTPException(status_code=400, detail="jd_markdown is required")

    # Update graph state
    graph_state = session_store.get_graph_state(session_id)
    if not graph_state:
        raise HTTPException(status_code=404, detail="Session not found")

    graph_state["final_jd_markdown"] = jd_markdown
    session_store.update_graph_state(session_id, graph_state)

    # Update position record in DB
    from backend.db.database import update_position_jd
    update_position_jd(session_id=session_id, jd_markdown=jd_markdown)

    # We removed the auto-trigger here. Users must explicitly click "Search Candidates"
    # to trigger candidate sourcing via a separate endpoint.

    return {"success": True}

@router.post("/sessions/{session_id}/upload")
async def upload_reference_jd(session_id: str, file: UploadFile = File(...)):
    """Handles parsing uploaded reference JDs and returning the text to the frontend."""
    if not session_store.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
        
    try:
        contents = await file.read()
        text_content = ""
        
        if file.filename.endswith('.pdf'):
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
                text_content = "\n".join(page.extract_text() for page in pdf_reader.pages)
            except Exception as e:
                print(f"Error reading PDF: {e}")
                raise HTTPException(status_code=400, detail="Could not read PDF file.")
        else:
            try:
                text_content = contents.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Only text and PDF files are supported.")

        # Return parsed text to frontend (frontend will include it in the chat message)
        return {
            "status": "success",
            "message": "File uploaded and parsed successfully.",
            "parsed_text": text_content[:4000]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in upload: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        error_detail = str(e)
        if DEBUG:
            error_detail += f"\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)
