"""
routers/jd.py – Legacy JD generation endpoint
Kept for backward compatibility. The primary flow now goes through
/api/chat/message → agent.py → drafting_node.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback
import sys
import backend.session_store as session_store
from backend.config import DEBUG

router = APIRouter(prefix="/api/jd", tags=["jd"])


class GenerateJDRequest(BaseModel):
    session_id: str
    selected_overview: str


@router.post("/generate")
async def generate_jd(request: GenerateJDRequest):
    """
    Legacy endpoint — generates full JD from a selected overview.
    The new flow uses the chat message endpoint instead.
    """
    session = session_store.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        from backend.nodes import drafting_node

        state = session_store.get_graph_state(request.session_id)
        state["messages"].append({
            "role": "user",
            "content": f"Selected overview: {request.selected_overview}\nPlease draft the final JD."
        })
        result = drafting_node(state)

        jd_markdown = result.get("final_jd_markdown", "")
        role_name = state.get("role_name", session["title"])

        return {"jd": jd_markdown, "role_name": role_name}
    except Exception as e:
        print(f"❌ Error in generate_jd: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        error_detail = str(e)
        if DEBUG:
            error_detail += f"\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)
