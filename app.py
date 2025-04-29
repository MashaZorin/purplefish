from __future__ import annotations as _annotations
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import scoped_session, sessionmaker

import asyncio

from pydantic import BaseModel

from agents import (
    Agent,
    HandoffOutputItem,
    ItemHelpers,
    MessageOutputItem,
    RunContextWrapper,
    Runner,
    ToolCallItem,
    ToolCallOutputItem,
    TResponseInputItem,
    function_tool,
    handoff,
    trace,
)
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX


app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

### SQLite Config

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
db = SQLAlchemy(app)
with app.app_context():
    Session = scoped_session(sessionmaker(bind=db.engine))

### SQLite Models

class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), default="Untitled Conversation")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True) 
    messages = db.relationship('Message', backref='conversation', cascade="all, delete-orphan")

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.String(10))  # user or assistant
    content = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'))

### Agent Context

class InterviewAgentContext(BaseModel):
    passenger_name: str | None = None
    confirmation_number: str | None = None
    seat_number: str | None = None
    flight_number: str | None = None

    is_active: bool | None = None


### Agent Tools

@function_tool
async def exit_tool(
    context: RunContextWrapper[InterviewAgentContext]
) -> str:
    """
    Exit the interview.
    """
    context.context.is_active = False
    return "Thank you for taking the time to interview. This session is now closed. Goodbye!"

@function_tool
async def salary_exit_tool(
    context: RunContextWrapper[InterviewAgentContext]
) -> str:
    """
    Exit the interview.
    """
    context.context.is_active = False
    return "Sorry, we are unable to offer you the salary you want. We wish you the best of luck elsewhere. Goodbye!"

@function_tool
async def experience_exit_tool(
    context: RunContextWrapper[InterviewAgentContext]
) -> str:
    """
    Exit the interview.
    """
    context.context.is_active = False
    return "Sorry, we expect at least 2 years of experience for this role. We wish you the best of luck elsewhere. Goodbye!"

### Agent Variables

role_name='ICU RN'
org_name='NYU Langone'
salary_min=50000
salary_max=80000
min_experience=2

### Agent

interview_agent = Agent[InterviewAgentContext](
    name="Interview Agent",
    handoff_description="A helpful triage agent that can decide which question agent to tranfer to.",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
    You are a helpful interview agent.
    Conduct an interview for a {role_name} role at {org_name} with a salary range of ${salary_min} to ${salary_max} and minimum {min_experience} years experience required.
    Use the following routine to interview the job applicant.
    # Routine
    1. Greet the job applicant and ask if they are interested in interviewing for a role.
    2. If they say no, use the exit tool to end the interview.
    3. If they say yes, ask for their name.
    4. Ask if they are interested in the {role_name} role.
    5. If they say no, use the exit tool to end the interview.
    6. If they say yes, ask for their desired salary.
    7. If the desired salary is higher than ${salary_max}, ask if ${salary_max} is ok.
    8. If they say no, use the salary exit tool to end the interview.
    9. Ask if the job applicant has relevant experience.
    10. If they say no, use the experience exit tool.
    11. If they say yes, ask how many years of experience they have.
    12. If they have less than {min_experience} years of experience, use the experience exit tool.
    13. Ask a follow-up question about experience.
    14. Use the exit tool to end the interview.
    15. If the user asks a question at any point, answer if it is relevent or decline to answer if it is irrelevant, and ask to continue the interview.""",
    tools=[exit_tool, salary_exit_tool, experience_exit_tool]
)


# initialize DB before first request
@app.before_request
def init_db():
    db.create_all()

@app.route("/")
def home():
    return render_template("index.html")

# Get list of conversations
@app.route("/conversations", methods=["GET"])
def get_conversations():
    with Session() as session:
        stmt = select(Conversation).order_by(Conversation.created_at.desc())
        conversations = session.scalars(stmt).all()
        return jsonify([
            {"id": convo.id, "title": convo.title}
            for convo in conversations
        ])

# Start a new conversation
@app.route("/conversations", methods=["POST"])
def create_conversation():
    title = request.json.get("title", "Untitled Conversation")
    convo = Conversation(title=title)
    with Session() as session:
        session.add(convo)
        session.commit()
        return jsonify({"id": convo.id, "title": convo.title})

# Get messages for a conversation
@app.route("/conversations/<int:conversation_id>/messages", methods=["GET"])
def get_messages(conversation_id):
    with Session() as session:
        convo = session.get(Conversation, conversation_id)
        if not convo:
            return jsonify({"error": "Conversation not found"}), 404

        messages = convo.messages
        return jsonify([{"role": m.role, "content": m.content} for m in messages])

# Main chat endpoint
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    conversation_id = data.get("conversation_id")
    user_input = data.get("message")

    if not conversation_id or not user_input:
        return jsonify({"error": "Missing conversation_id or message"}), 400

    with Session() as session:
        convo = session.get(Conversation, conversation_id)
        if not convo:
            return jsonify({"error": "Conversation not found"}), 404

        # ensure we are not in a inactive chat
        if not convo.is_active:
            return jsonify({"response": "This conversation has ended.", "ended": True})

        # Store user message
        user_msg = Message(role="user", content=user_input, conversation=convo)
        session.add(user_msg)

        # Build full history
        history = [{"role": m.role, "content": m.content} for m in convo.messages]
        history.append({"role": "user", "content": user_input})

        current_agent: Agent[InterviewAgentContext] = interview_agent
        input_items: list[TResponseInputItem] = []
        context = InterviewAgentContext()

        # define async function to call agent
        async def agent_call(conv_id, current_agent, input_items, context):
            with trace("Customer service", group_id=conv_id):
                # add full history to input items
                input_items += history
                # run agent to get next response
                result = await Runner.run(current_agent, input_items, context=context)

                for new_item in result.new_items:
                    agent_name = new_item.agent.name
                    # if the item is the final text output
                    if isinstance(new_item, MessageOutputItem):
                        bot_reply = ItemHelpers.text_message_output(new_item)
                        # check if we triggered an early exit
                        if context.is_active is not None and not context.is_active:
                            convo.is_active = False
                            db.session.commit()
                            return bot_reply, True

                        return bot_reply, False
                    # for debugging
                    elif isinstance(new_item, ToolCallItem):
                        print(f"{agent_name}: Calling a tool")
                    elif isinstance(new_item, ToolCallOutputItem):
                        print(f"{agent_name}: Tool call output: {new_item.output}")
                    else:
                        print(f"{agent_name}: Skipping item: {new_item.__class__.__name__}")

        try:
            reply, ended = asyncio.run(agent_call(f'{conversation_id}', current_agent, input_items, context))
        except Exception as e:
            reply = 'Sorry, something went wrong'
            ended = False

        assistant_msg = Message(role="assistant", content=reply, conversation=convo)
        session.add(assistant_msg)
        session.commit()

        return jsonify({"response": reply, "ended": ended})

if __name__ == "__main__":
    app.run(debug=True)