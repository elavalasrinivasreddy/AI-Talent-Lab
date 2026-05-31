import sys

file_path = "backend/services/chat_service.py"
with open(file_path, "r") as f:
    content = f.read()

target = """                if action == "apply_bias_fix":
                    yield StreamHandler.emit_metadata({
                        "final_jd": new_state.get("final_jd", "")
                    })"""

replacement = """                if action == "apply_bias_fix":
                    yield StreamHandler.emit_metadata({
                        "final_jd": new_state.get("final_jd", "")
                    })
            
            # Emit metadata for the newly generated final_jd if we streamed it
            # or if the stage is final_jd and it was just regenerated.
            if will_stream_final or (current_stage == "final_jd" and new_state.get("final_jd")):
                yield StreamHandler.emit_metadata({
                    "final_jd": new_state.get("final_jd", "")
                })"""

content = content.replace(target, replacement)

# We also need to fix will_stream_final to be True if the previous state was bias_check or complete
# and user_message is sent, because orchestrator will force it back to final_jd!
target_will_stream = """            will_stream_final = (
                action == "select_variant"
                or action in {"rewrite_section", "regenerate_variants"}
                or (state.get("stage") == "final_jd" and user_message)
            )"""

replacement_will_stream = """            will_stream_final = (
                action == "select_variant"
                or action in {"rewrite_section", "regenerate_variants"}
                or (state.get("stage") in ("final_jd", "bias_check", "complete") and user_message)
            )"""

content = content.replace(target_will_stream, replacement_will_stream)

with open(file_path, "w") as f:
    f.write(content)
print("Updated chat_service.py")
