import sys

file_path = "backend/agents/orchestrator.py"
with open(file_path, "r") as f:
    content = f.read()

# When user_message is provided, if current stage is bias_check or complete, push back to final_jd
target = """    if user_message:
        state["messages"] = state.get("messages", []) + [
            {"role": "user", "content": user_message}
        ]
        state["user_action"] = "message"
        state["user_action_data"] = {}
        state["awaiting_user_input"] = False"""

replacement = """    if user_message:
        state["messages"] = state.get("messages", []) + [
            {"role": "user", "content": user_message}
        ]
        state["user_action"] = "message"
        state["user_action_data"] = {}
        state["awaiting_user_input"] = False
        
        # If user sends a refinement message, force the stage back to final_jd
        # so the agent will run the drafting_final node and actually regenerate it.
        if state.get("stage") in ("bias_check", "complete"):
            state["stage"] = "final_jd\""""

content = content.replace(target, replacement)

# Also fix the retry logic in final_jd block so it loops instead of breaking immediately
target_final_jd = """        elif current_stage == "final_jd":
            state = await run_drafting_final(state, token_queue=token_queue)
            if not state.get("error_stage"):
                # No longer run bias check automatically. Wait for user to trigger or finalize.
                state["awaiting_user_input"] = True
                state["stage"] = "final_jd"
            break"""

replacement_final_jd = """        elif current_stage == "final_jd":
            state = await run_drafting_final(state, token_queue=token_queue)
            if state.get("error_stage"):
                break
            
            # If it failed but didn't set error_stage (retry_count < 2), loop again!
            if not state.get("final_jd") or state.get("retry_count", 0) > 0:
                continue
                
            # Success
            state["awaiting_user_input"] = True
            state["stage"] = "final_jd"
            break"""

content = content.replace(target_final_jd, replacement_final_jd)

with open(file_path, "w") as f:
    f.write(content)
print("Updated orchestrator.py")
