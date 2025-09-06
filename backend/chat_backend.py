import gradio as gr
from collections import Counter, defaultdict
import re

# -------------------------------
# Chat history tracker per project
# -------------------------------
project_chats = {}  # { project_id: [messages] }

# -------------------------------
# Functions
# -------------------------------
def add_message(project_id, message):
    """Add user message to a project's chat history"""
    if not project_id:
        return "Error: No project ID provided."
    
    if project_id not in project_chats:
        project_chats[project_id] = []
    
    if message.strip() == "":
        return "\n".join(project_chats[project_id])
    
    project_chats[project_id].append(message)
    return "\n".join(project_chats[project_id])


def cluster_messages_by_topic(messages, top_n=5):
    clean_text = re.sub(r"[^a-zA-Z0-9\s]", "", " ".join(messages))
    words = [w.lower() for w in clean_text.split() if len(w) > 3]
    word_counts = Counter(words)
    top_keywords = [w for w, _ in word_counts.most_common(top_n)]
    
    clusters = defaultdict(list)
    for msg in messages:
        msg_text = msg.split(": ",1)[-1].lower()
        assigned = False
        for kw in top_keywords:
            if kw in msg_text:
                clusters[kw].append(msg)
                assigned = True
                break
        if not assigned:
            clusters["misc"].append(msg)
    return clusters


def generate_topic_summaries(clustered_msgs):
    summaries = {}
    action_keywords = ["should", "need", "plan", "decide", "focus", "do", "complete", "try", "test"]
    
    for topic, msgs in clustered_msgs.items():
        if not msgs:
            continue
        snippet = " ".join([m.split(": ",1)[-1] for m in msgs[:2]])
        actions = [m.split(": ",1)[-1] for m in msgs if any(kw in m.lower() for kw in action_keywords)]
        summary_text = f"{snippet}"
        if actions:
            summary_text += f" [Actions: {', '.join(actions[:2])}]"
        summaries[topic] = summary_text
    return summaries


def advanced_interactive_summary(project_id):
    if project_id not in project_chats or not project_chats[project_id]:
        return "No chat to summarize yet.", {}
    
    history = project_chats[project_id]
    clustered = cluster_messages_by_topic(history)
    topic_summaries = generate_topic_summaries(clustered)
    
    top_keywords = [kw for kw in clustered.keys() if kw != "misc"][:5]
    overall_summary = (
        f"Project {project_id} chat contains {len(history)} messages discussing topics like {', '.join(top_keywords)}. "
        f"Last message: '{history[-1].split(': ',1)[-1]}'"
    )
    
    return overall_summary, topic_summaries


# -------------------------------
# Gradio API Interface
# -------------------------------
with gr.Blocks() as demo:
    gr.Markdown("## 🚀 Project Chat Summarizer (Multi-Project)")
    
    project_id_in = gr.Textbox(label="Project ID")
    chat_input = gr.Textbox(label="Type your message here")
    chat_display = gr.Textbox(label="Chat History", interactive=False)
    
    summarize_btn = gr.Button("Summarize Chat")
    summary_output = gr.Textbox(label="Overall Summary", interactive=False)
    topic_output = gr.JSON(label="Topic Summaries")

    # Add message endpoint
    chat_input.submit(
        add_message,
        inputs=[project_id_in, chat_input],
        outputs=chat_display
    )

    # Summarize endpoint
    summarize_btn.click(
        advanced_interactive_summary,
        inputs=project_id_in,
        outputs=[summary_output, topic_output]
    )

demo.launch(server_name="0.0.0.0", server_port=7860, enable_queue=True, share=False)