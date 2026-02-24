from openai import OpenAI
client = OpenAI()

def summarize_with_context(transcript, previous_summary=None):
    context = f"Previous issue summary: {previous_summary}\n\n" if previous_summary else ""

    prompt = f"""
    {context}
    Summarize this support call in structured format:
    - Issue Type
    - Customer Expertise Level (Beginner/Intermediate/Expert)
    - Main Problem
    - Resolution Status
    - Suggested Routing Category (Sales/Technical/Billing)

    Transcript:
    {transcript}
    """

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    return response.choices[0].message.content